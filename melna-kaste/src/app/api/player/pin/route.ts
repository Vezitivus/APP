import { hashPin, isValidPin, verifyPin } from "@/lib/auth/pin";
import { limit, mutate } from "@/lib/db/repository";
import { isPinLocked } from "@/lib/game/engine";
import { toPlayerState } from "@/lib/game/project";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { currentPlayer, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return asResponse(async () => {
    const auth = await currentPlayer(request);
    if (!auth) return jsonError(401, "Sesija nav atrasta.", "auth");
    await limit(`pin:${auth.player.id}`, 10, 15 * 60 * 1000);
    await limit(`pin-ip:${clientIp(request)}`, 15, 15 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { oldPin?: string; newPin?: string } | null;
    const oldPin = typeof body?.oldPin === "string" ? body.oldPin.trim() : "";
    const newPin = typeof body?.newPin === "string" ? body.newPin.trim() : "";
    if (!isValidPin(oldPin) || !isValidPin(newPin)) return jsonError(400, "Ievadi esošo un jauno 4 ciparu PIN.", "invalid");
    if (oldPin === newPin) return jsonError(400, "Jaunajam PIN jābūt citam.", "invalid");
    const ctx = serverCtx();
    if (isPinLocked(auth.player, ctx.now)) return jsonError(429, "Pārāk daudz mēģinājumu. Uzgaidi brīdi.", "rate");
    const ok = await verifyPin(oldPin, auth.player.pinHash);
    if (!ok) {
      const failed = await mutate({ type: "pin_failed", playerId: auth.player.id }, ctx);
      const next = failed.state.players.find((item) => item.id === auth.player.id);
      if (next && isPinLocked(next, ctx.now)) return jsonError(429, "Pārāk daudz mēģinājumu. Uzgaidi brīdi.", "rate");
      return jsonError(401, "Esošais PIN nav pareizs.", "auth");
    }
    const result = await mutate({ type: "reset_pin", playerId: auth.player.id, pinHash: await hashPin(newPin) }, ctx);
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    const player = result.state.players.find((item) => item.id === auth.player.id);
    if (!player) return jsonError(401, "Dalībnieks vairs nav spēlē.", "auth");
    return Response.json({ game: toPlayerState(result.state, player, ctx.now) });
  });
}
