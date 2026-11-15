import { cloudinaryConfigured, listCloudinaryVideos } from "@/lib/cloudinary/sync";
import { mutate } from "@/lib/db/repository";
import { asResponse, jsonError } from "@/lib/http/http";
import { requireAdmin, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST() {
  return asResponse(async () => {
    if (!(await requireAdmin())) return jsonError(401, "Nepieciešama organizatora pieteikšanās.", "auth");
    if (!cloudinaryConfigured()) return jsonError(503, "Cloudinary nav konfigurēts.", "config");
    const videos = await listCloudinaryVideos();
    const result = await mutate({ type: "sync_videos", videos }, serverCtx());
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    return Response.json({ count: videos.length });
  });
}
