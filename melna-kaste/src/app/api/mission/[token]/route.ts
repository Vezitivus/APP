import { limit, mutate } from "@/lib/db/repository";
import { missionView } from "@/lib/game/project";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { currentPlayer, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return asResponse(async () => {
    await limit(`mission:${clientIp(request)}`, 60, 10 * 60 * 1000);
    const { token } = await context.params;
    const auth = await currentPlayer(request);
    const ctx = serverCtx();
    const ticked = await mutate({ type: "tick" }, ctx);
    if (ticked.error?.code === "not_ready") return jsonError(404, "Kartīte nav aktīva.", "inactive");
    const view = missionView(ticked.state, token, auth?.player.id ?? null, ctx.now);
    return Response.json(view);
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return asResponse(async () => {
    await limit(`mission:${clientIp(request)}`, 60, 10 * 60 * 1000);
    const auth = await currentPlayer(request);
    if (!auth) return jsonError(401, "Vispirms atjauno savu sesiju.", "need_session");
    const { token } = await context.params;
    const ctx = serverCtx();
    const result = await mutate({ type: "claim", qrToken: token, playerId: auth.player.id }, ctx);
    if (result.error) {
      const status = result.error.code === "wrong_player" ? 403 : 409;
      return jsonError(status, result.error.message, result.error.code);
    }
    const view = missionView(result.state, token, auth.player.id, ctx.now);
    return Response.json(view);
  });
}
