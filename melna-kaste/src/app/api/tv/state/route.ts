import { toTvState } from "@/lib/game/project";
import { asResponse } from "@/lib/http/http";
import { pairedTv, serverCtx, tickedState } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET() {
  return asResponse(async () => {
    const paired = await pairedTv();
    const state = await tickedState();
    if (!state) return Response.json({ paired, game: null, serverNow: new Date().toISOString() });
    return Response.json({ paired, game: toTvState(state, serverCtx().now, { includePreload: paired }) });
  });
}
