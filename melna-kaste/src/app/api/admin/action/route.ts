import { randomCode, randomToken, sha256 } from "@/lib/auth/crypto";
import { createSession, issueTvPair, limit, mutate } from "@/lib/db/repository";
import { validateCustomCard } from "@/lib/game/engine";
import { toAdminState } from "@/lib/game/project";
import { TEST_PLAYER_NAMES, type Action, type CardDef } from "@/lib/game/types";
import { asResponse, clientIp, jsonError, publicOrigin } from "@/lib/http/http";
import { requireAdmin, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<Action["type"]>([
  "rename_player",
  "remove_player",
  "set_eligible",
  "update_settings",
  "start",
  "pause",
  "resume",
  "finish",
  "reset",
  "set_auto",
  "prepare",
  "accelerate",
  "call_now",
  "skip",
  "continue_tv",
  "swap_player",
  "complete_event",
  "fail_event",
  "activate_global",
  "confirm_mission",
  "fail_mission",
  "confirm_perk",
  "upsert_card",
  "delete_card",
  "add_test_players",
  "reissue_recovery",
]);

export async function POST(request: Request) {
  return asResponse(async () => {
    if (!(await requireAdmin())) return jsonError(401, "Nepieciešama organizatora pieteikšanās.", "auth");
    await limit(`admin:${clientIp(request)}`, 180, 60 * 1000);
    const body = (await request.json().catch(() => null)) as (Action & { confirm?: boolean }) | { type: "create_game" } | null;
    if (!body || typeof body.type !== "string") return jsonError(400, "Nederīgs pieprasījums.", "invalid");
    const ctx = serverCtx();
    if (body.type === "create_game") {
      const state = await createSession(ctx.now);
      const token = await issueTvPair(state.id);
      return Response.json({
        game: toAdminState(state, ctx.now),
        tvPath: `/tv?pair=${token}`,
        tvUrl: `${publicOrigin(request)}/tv?pair=${token}`,
      });
    }
    if (!ALLOWED.has(body.type as Action["type"])) return jsonError(400, "Šī darbība nav atļauta.", "invalid");
    if (body.type === "reset" && body.confirm !== true) return jsonError(400, "Atiestatīšanai vajag apstiprinājumu.", "confirm");
    const action = await buildAction(body as Action & { confirm?: boolean });
    if (!action) return jsonError(400, "Nederīgi darbības dati.", "invalid");
    const result = await mutate(action, ctx);
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    const response: Record<string, unknown> = { game: toAdminState(result.state, ctx.now) };
    if (result.issued?.testPlayers) response.testPlayers = result.issued.testPlayers;
    if (result.issued?.recoveryCode) response.recoveryCode = result.issued.recoveryCode;
    if (body.type === "start") {
      const pair = await issueTvPair(result.state.id);
      response.tvUrl = `${publicOrigin(request)}/tv?pair=${pair}`;
    }
    return Response.json(response);
  });
}

async function buildAction(body: Action & { confirm?: boolean }): Promise<Action | null> {
  if (body.type === "add_test_players") {
    return {
      type: "add_test_players",
      players: TEST_PLAYER_NAMES.map(() => {
        const recoveryCode = randomCode();
        return { sessionHash: sha256(randomToken()), recoveryHash: sha256(recoveryCode), recoveryCode };
      }),
    };
  }
  if (body.type === "reissue_recovery") {
    if (!("playerId" in body) || typeof body.playerId !== "string") return null;
    const recoveryCode = randomCode();
    return { type: "reissue_recovery", playerId: body.playerId, recoveryHash: sha256(recoveryCode), recoveryCode };
  }
  if (body.type === "upsert_card") {
    if (!("card" in body)) return null;
    try {
      return { type: "upsert_card", card: validateCustomCard(body.card as CardDef) };
    } catch {
      return null;
    }
  }
  return body;
}
