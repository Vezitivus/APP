import { expectedLibrary, expectedPresence, standbyPlaylist, standbySlots } from "@/lib/game/videos";
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
    const playlist = standbyPlaylist(videos);
    const currentName = state?.playback.mode === "standby" ? playlist[state.playback.index]?.filename ?? null : null;
    return Response.json({
      videos,
      standby: playlist.map((video) => ({ filename: video.filename, url: video.url })),
      slots: standbySlots(videos).map((slot) => ({
        ...slot,
        current: Boolean(currentName && slot.filename === currentName),
      })),
      expected: expected.map((file) => ({ ...file, ...expectedPresence(file, videos) })),
    });
  });
}
