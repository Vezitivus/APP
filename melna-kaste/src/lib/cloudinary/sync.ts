import { Buffer } from "node:buffer";
import { classifyCloudinaryAsset, folderHintFromPath, isCloudinaryDeliveryUrl } from "@/lib/game/videos";
import type { VideoAsset } from "@/lib/game/types";
import { serverEnv } from "@/lib/server/env";
import { cloudinaryPlaybackUrl } from "@/lib/tv/playback";

const ROOT_FOLDER = "melna-kaste";
const LEGACY_FOLDERS = ["standby", "calls", "special"] as const;
const MAX_PAGES = 20;

interface CloudinaryResource {
  public_id?: string;
  asset_folder?: string;
  secure_url?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  resource_type?: string;
  type?: string;
  display_name?: string;
  original_filename?: string;
}

interface CloudinaryPage {
  resources?: CloudinaryResource[];
  next_cursor?: string;
}

export function cloudinaryConfigured(): boolean {
  return Boolean(serverEnv("CLOUDINARY_CLOUD_NAME") && serverEnv("CLOUDINARY_API_KEY") && serverEnv("CLOUDINARY_API_SECRET"));
}

/**
 * New accounts keep every video in asset_folder `melna-kaste` and classify
 * by name. Older accounts that used `melna-kaste/standby|calls|special`
 * (fixed public-id prefixes or dynamic subfolders) are still listed and
 * merged. `by_asset_folder` is 404 on a fixed-folder product environment.
 */
export async function listCloudinaryVideos(): Promise<VideoAsset[]> {
  const cloud = serverEnv("CLOUDINARY_CLOUD_NAME") ?? "";
  const key = serverEnv("CLOUDINARY_API_KEY") ?? "";
  const secret = serverEnv("CLOUDINARY_API_SECRET") ?? "";
  if (!cloud || !key || !secret) throw new Error("Cloudinary nav konfigurēts");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const [prefixed, prefixedRoot, byLegacyFolder, byRoot] = await Promise.all([
    Promise.all(LEGACY_FOLDERS.map((folder) => listByPrefix(cloud, auth, `${ROOT_FOLDER}/${folder}/`))),
    listByPrefix(cloud, auth, `${ROOT_FOLDER}/`),
    Promise.all(LEGACY_FOLDERS.map((folder) => listByAssetFolder(cloud, auth, `${ROOT_FOLDER}/${folder}`))),
    listByAssetFolder(cloud, auth, ROOT_FOLDER),
  ]);
  const merged = new Map<string, VideoAsset>();
  const ingest = (resources: CloudinaryResource[], hinted?: VideoAsset["folder"] | null) => {
    for (const resource of resources) {
      const asset = toAsset(resource, cloud, hinted);
      if (asset) merged.set(asset.publicId, asset);
    }
  };
  LEGACY_FOLDERS.forEach((folder, index) => ingest(prefixed[index] ?? [], folder));
  ingest(prefixedRoot);
  // Media Library folder wins when the same public id is also matched by prefix.
  LEGACY_FOLDERS.forEach((folder, index) => ingest(byLegacyFolder[index] ?? [], folder));
  ingest(byRoot);
  return [...merged.values()];
}

async function listByPrefix(cloud: string, auth: string, prefix: string): Promise<CloudinaryResource[]> {
  return listPages(cloud, auth, "resources/video/upload", { prefix, resource_type: "video" }, false);
}

async function listByAssetFolder(cloud: string, auth: string, assetFolder: string): Promise<CloudinaryResource[]> {
  return listPages(cloud, auth, "resources/by_asset_folder", { asset_folder: assetFolder }, true);
}

async function listPages(
  cloud: string,
  auth: string,
  path: string,
  params: Record<string, string>,
  missingOk: boolean,
): Promise<CloudinaryResource[]> {
  const resources: CloudinaryResource[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: Record<string, string> = { ...params, max_results: "100" };
    if (cursor) query.next_cursor = cursor;
    const response = await cloudinaryFetch(cloud, auth, path, query);
    if (response.status === 404 && missingOk && !cursor) {
      await response.arrayBuffer().catch(() => undefined);
      return [];
    }
    if (!response.ok) throw new Error(`Cloudinary atbildēja ar statusu ${response.status}`);
    const body = (await response.json()) as CloudinaryPage;
    resources.push(...(body.resources ?? []));
    if (!body.next_cursor || seenCursors.has(body.next_cursor)) break;
    seenCursors.add(body.next_cursor);
    cursor = body.next_cursor;
  }
  return resources;
}

async function cloudinaryFetch(cloud: string, auth: string, path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return fetch(url, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" });
}

function toAsset(resource: CloudinaryResource, cloud: string, hinted?: VideoAsset["folder"] | null): VideoAsset | null {
  if (!resource.public_id || !resource.secure_url) return null;
  if (resource.resource_type && resource.resource_type !== "video") return null;
  if (resource.type && resource.type !== "upload") return null;
  if (!isCloudinaryDeliveryUrl(resource.secure_url, cloud)) return null;
  const pathHint = hinted ?? folderHintFromPath(resource.asset_folder) ?? folderHintFromPath(resource.public_id);
  const classified = classifyCloudinaryAsset(
    {
      publicId: resource.public_id,
      displayName: resource.display_name,
      originalFilename: resource.original_filename,
    },
    pathHint,
  );
  if (!classified) return null;
  return {
    id: resource.public_id,
    publicId: resource.public_id,
    folder: classified.folder,
    filename: classified.filename,
    url: resource.secure_url,
    bytes: typeof resource.bytes === "number" ? resource.bytes : null,
    width: typeof resource.width === "number" ? resource.width : null,
    height: typeof resource.height === "number" ? resource.height : null,
    durationSeconds: typeof resource.duration === "number" ? resource.duration : null,
  };
}



const EAGER_TRANSFORM = "f_mp4,vc_h264,q_auto";

/** Ask Cloudinary to generate the exact TV delivery derivative, then fetch the first bytes so the CDN is warm. */
export async function warmPlaybackLibrary(videos: VideoAsset[]): Promise<{ eager: number; warmed: number }> {
  const cloud = serverEnv("CLOUDINARY_CLOUD_NAME") ?? "";
  const key = serverEnv("CLOUDINARY_API_KEY") ?? "";
  const secret = serverEnv("CLOUDINARY_API_SECRET") ?? "";
  const auth = cloud && key && secret ? Buffer.from(`${key}:${secret}`).toString("base64") : "";
  let eager = 0;
  let warmed = 0;
  const queue = [...videos];
  const workers = 4;
  async function worker() {
    while (queue.length) {
      const video = queue.shift();
      if (!video) break;
      if (auth) {
        const ok = await eagerPlayback(cloud, auth, video.publicId);
        if (ok) eager += 1;
      }
      const url = cloudinaryPlaybackUrl(video.url);
      if (url && (await fetchHead(url))) warmed += 1;
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { eager, warmed };
}

async function eagerPlayback(cloud: string, auth: string, publicId: string): Promise<boolean> {
  const body = new URLSearchParams({
    public_id: publicId,
    type: "upload",
    eager: EAGER_TRANSFORM,
    eager_async: "true",
  });
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/video/explicit`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    await response.arrayBuffer().catch(() => undefined);
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchHead(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { Range: "bytes=0-2047" }, cache: "no-store" });
    await response.arrayBuffer().catch(() => undefined);
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}
