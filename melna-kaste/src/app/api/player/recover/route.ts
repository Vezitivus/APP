import { cookies } from "next/headers";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { isValidPin, verifyPin } from "@/lib/auth/pin";
import { limit, mutate, readCurrent } from "@/lib/db/repository";
import { findPlayersByName, isPinLocked, sanitizeName } from "@/lib/game/engine";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { cookieOptions, playerCookie, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

const AUTH_FAIL = { status: 401 as const, message: "Vārds un PIN nesakrīt.", code: "auth" };

export async function POST(request: Request) {
  return asResponse(async () => {
    const ip = clientIp(request);
    await limit(`recover:${ip}`, 10, 10 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { name?: string; pin?: string; code?: string } | null;
    const name = sanitizeName(body?.name ?? "");
    const pin = typeof body?.pin === "string" ? body.pin.trim() : typeof body?.code === "string" ? body.code.trim() : "";
    if (!name || !isValidPin(pin)) return jsonError(400, "Ievadi vārdu un savu 4 ciparu PIN.", "invalid");
    await limit(`recover-name:${name.toLocaleLowerCase("lv")}`, 8, 15 * 60 * 1000);
    const state = await readCurrent();
    if (!state) return jsonError(409, "Spēle vēl nav izveidota.", "not_ready");
    const matches = findPlayersByName(state, name);
    const ctx = serverCtx();
    const player = matches.length === 1 ? matches[0] : null;
    if (player && isPinLocked(player, ctx.now)) {
      return jsonError(429, "Pārāk daudz mēģinājumu. Uzgaidi brīdi.", "rate");
    }
    const ok = player ? await verifyPin(pin, player.pinHash) : false;
    if (!player || !ok) {
      if (player) {
        const failed = await mutate({ type: "pin_failed", playerId: player.id }, ctx);
        if (failed.state && isPinLocked(findPlayersByName(failed.state, name)[0] ?? player, ctx.now)) {
          return jsonError(429, "Pārāk daudz mēģinājumu. Uzgaidi brīdi.", "rate");
        }
      }
      return jsonError(AUTH_FAIL.status, AUTH_FAIL.message, AUTH_FAIL.code);
    }
    const secret = randomToken();
    const result = await mutate({ type: "rotate_session", playerId: player.id, sessionHash: sha256(secret) }, ctx);
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    const token = playerCookie(player.id, secret);
    const jar = await cookies();
    jar.set("mk_player", token, cookieOptions(60 * 60 * 36));
    return Response.json({ publicName: player.publicName, token });
  });
}
