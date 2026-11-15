import { isCloudinaryDeliveryUrl } from "@/lib/game/videos";
import type { VideoAsset } from "@/lib/game/types";

interface CloudinaryResource {
  public_id?: string;
  secure_url?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
}

export function cloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export async function listCloudinaryVideos(): Promise<VideoAsset[]> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const key = process.env.CLOUDINARY_API_KEY ?? "";
  const secret = process.env.CLOUDINARY_API_SECRET ?? "";
  if (!cloud || !key || !secret) throw new Error("Cloudinary nav konfigurēts");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const videos: VideoAsset[] = [];
  for (const folder of ["standby", "calls", "special"] as const) {
    let cursor: string | undefined;
    do {
      const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/resources/video/upload`);
      url.searchParams.set("prefix", `melna-kaste/${folder}/`);
      url.searchParams.set("max_results", "100");
      url.searchParams.set("resource_type", "video");
      if (cursor) url.searchParams.set("next_cursor", cursor);
      const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`Cloudinary atbildēja ar statusu ${response.status}`);
      const body = (await response.json()) as { resources?: CloudinaryResource[]; next_cursor?: string };
      for (const resource of body.resources ?? []) {
        const asset = toAsset(resource, folder, cloud);
        if (asset) videos.push(asset);
      }
      cursor = body.next_cursor;
    } while (cursor);
  }
  return videos;
}

function toAsset(resource: CloudinaryResource, folder: VideoAsset["folder"], cloud: string): VideoAsset | null {
  if (!resource.public_id || !resource.secure_url) return null;
  if (!isCloudinaryDeliveryUrl(resource.secure_url, cloud)) return null;
  const leaf = resource.public_id.split("/").pop() ?? "";
  if (!leaf || leaf.includes("..")) return null;
  const filename = leaf.toLowerCase().endsWith(".mp4") ? leaf : `${leaf}.mp4`;
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
