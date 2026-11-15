import { expectedLibrary } from "@/lib/game/videos";
import { readCurrent } from "@/lib/db/repository";
import { asResponse, jsonError } from "@/lib/http/http";
import { requireAdmin } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET() {
  return asResponse(async () => {
    if (!(await requireAdmin())) return jsonError(401, "Nepieciešama organizatora pieteikšanās.", "auth");
    const state = await readCurrent();
    const videos = state?.videos ?? [];
    const expected = expectedLibrary(state?.customCards ?? []);
    const have = new Set(videos.map((video) => `${video.folder}/${video.filename.toLowerCase()}`));
    return Response.json({
      videos,
      standby: videos.filter((video) => video.folder === "standby").sort((a, b) => a.filename.localeCompare(b.filename, "lv")),
      expected: expected.map((file) => ({ ...file, present: have.has(`${file.folder}/${file.filename.toLowerCase()}`) })),
    });
  });
}
