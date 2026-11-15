import { limit, mutate } from "@/lib/db/repository";
import { toPlayerState } from "@/lib/game/project";
import type { Action } from "@/lib/game/types";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { currentPlayer, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return asResponse(async () => {
    const auth = await currentPlayer(request);
    if (!auth) return jsonError(401, "Sesija nav atrasta.", "auth");
    await limit(`player:${auth.player.id}`, 60, 60 * 1000);
    await limit(`player-ip:${clientIp(request)}`, 80, 60 * 1000);
    const body = (await request.json().catch(() => null)) as Partial<Action> | null;
    const action = playerAction(body, auth.player.id);
    if (!action) return jsonError(400, "Nederīga darbība.", "invalid");
    const ctx = serverCtx();
    const result = await mutate(action, ctx);
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    const player = result.state.players.find((item) => item.id === auth.player.id);
    if (!player) return jsonError(401, "Dalībnieks vairs nav spēlē.", "auth");
    return Response.json({ game: toPlayerState(result.state, player, ctx.now) });
  });
}

function playerAction(body: Partial<Action> | null, playerId: string): Action | null {
  if (!body?.type) return null;
  if (body.type === "decline") return { type: "decline", playerId };
  if (body.type === "complete_mission" && typeof body.missionId === "string") {
    return { type: "complete_mission", missionId: body.missionId, playerId };
  }
  if (body.type === "request_perk" && typeof body.perkId === "string") {
    return { type: "request_perk", perkId: body.perkId, playerId };
  }
  if (body.type === "claim" && typeof body.qrToken === "string") return { type: "claim", qrToken: body.qrToken, playerId };
  if (body.type === "submit_selection" && Array.isArray(body.partnerIds)) {
    return {
      type: "submit_selection",
      playerId,
      partnerIds: body.partnerIds.filter((id): id is string => typeof id === "string"),
      activityTitle: typeof body.activityTitle === "string" ? body.activityTitle : undefined,
      activityRules: typeof body.activityRules === "string" ? body.activityRules : undefined,
      mode: body.mode === "duel" || body.mode === "group" ? body.mode : undefined,
    };
  }
  return null;
}
