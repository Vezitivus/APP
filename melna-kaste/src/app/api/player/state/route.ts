import { markSeen } from "@/lib/db/repository";
import { toPlayerState } from "@/lib/game/project";
import { asResponse, jsonError } from "@/lib/http/http";
import { currentPlayer, serverCtx, tickedState } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return asResponse(async () => {
    const auth = await currentPlayer(request);
    if (!auth) return jsonError(401, "Sesija nav atrasta. Atjauno to ar kodu.", "auth");
    await markSeen(auth.player.id);
    const state = await tickedState();
    if (!state) return jsonError(409, "Spēle nav atrasta.", "not_ready");
    const player = state.players.find((item) => item.id === auth.player.id && !item.removed);
    if (!player) return jsonError(401, "Dalībnieks vairs nav spēlē.", "auth");
    return Response.json({ game: toPlayerState(state, player, serverCtx().now) });
  });
}
