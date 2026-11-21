import { Buffer } from "node:buffer";
import { filenameForCloudinaryAsset, isCloudinaryDeliveryUrl } from "@/lib/game/videos";
import type { VideoAsset } from "@/lib/game/types";
import { serverEnv } from "@/lib/server/env";

const FOLDERS = ["standby", "calls", "special"] as const;
const MAX_PAGES = 20;

interface CloudinaryResource {
  public_id?: string;
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
 * Fixed-folder accounts keep the folder in public_id, listed with `prefix`.
 * Dynamic-folder accounts (Cloudinary signups after June 2024) keep the
 * Media Library path in `asset_folder`. `by_asset_folder` is 404 on a
 * fixed-folder product environment, so both listings are merged.
 */
export async function listCloudinaryVideos(): Promise<VideoAsset[]> {
  const cloud = serverEnv("CLOUDINARY_CLOUD_NAME") ?? "";
  const key = serverEnv("CLOUDINARY_API_KEY") ?? "";
  const secret = serverEnv("CLOUDINARY_API_SECRET") ?? "";
  if (!cloud || !key || !secret) throw new Error("Cloudinary nav konfigurēts");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const [prefixed, byFolder] = await Promise.all([
    Promise.all(FOLDERS.map((folder) => listByPrefix(cloud, auth, folder))),
    Promise.all(FOLDERS.map((folder) => listByAssetFolder(cloud, auth, folder))),
  ]);
  const merged = new Map<string, VideoAsset>();
  FOLDERS.forEach((folder, index) => {
    for (const resource of prefixed[index] ?? []) {
      const asset = toAsset(resource, folder, cloud);
      if (asset) merged.set(asset.publicId, asset);
    }
  });
  // Media Library folder wins when the same public id is also matched by prefix.
  FOLDERS.forEach((folder, index) => {
    for (const resource of byFolder[index] ?? []) {
      const asset = toAsset(resource, folder, cloud);
      if (asset) merged.set(asset.publicId, asset);
    }
  });
  return [...merged.values()];
}

async function listByPrefix(cloud: string, auth: string, folder: (typeof FOLDERS)[number]): Promise<CloudinaryResource[]> {
  return listPages(cloud, auth, "resources/video/upload", { prefix: `melna-kaste/${folder}/`, resource_type: "video" }, false);
}

async function listByAssetFolder(cloud: string, auth: string, folder: (typeof FOLDERS)[number]): Promise<CloudinaryResource[]> {
  return listPages(cloud, auth, "resources/by_asset_folder", { asset_folder: `melna-kaste/${folder}` }, true);
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

function toAsset(resource: CloudinaryResource, folder: VideoAsset["folder"], cloud: string): VideoAsset | null {
  if (!resource.public_id || !resource.secure_url) return null;
  if (resource.resource_type && resource.resource_type !== "video") return null;
  if (resource.type && resource.type !== "upload") return null;
  if (!isCloudinaryDeliveryUrl(resource.secure_url, cloud)) return null;
  const filename = filenameForCloudinaryAsset(folder, {
    publicId: resource.public_id,
    displayName: resource.display_name,
    originalFilename: resource.original_filename,
  });
  if (!filename) return null;
  return {
    id: resource.public_id,
    publicId: resource.public_id,
    folder,
    filename,
    url: resource.secure_url,
    bytes: typeof resource.bytes === "number" ? resource.bytes : null,
    width: typeof resource.width === "number" ? resource.width : null,
    height: typeof resource.height === "number" ? resource.height : null,
    durationSeconds: typeof resource.duration === "number" ? resource.duration : null,
  };
}
