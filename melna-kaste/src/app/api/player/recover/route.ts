import { cookies } from "next/headers";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { limit, mutate, readCurrent } from "@/lib/db/repository";
import { sanitizeName } from "@/lib/game/engine";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { cookieOptions, playerCookie, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return asResponse(async () => {
    await limit(`recover:${clientIp(request)}`, 20, 10 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { name?: string; code?: string } | null;
    const name = sanitizeName(body?.name ?? "");
    const code = (body?.code ?? "").trim().toUpperCase();
    if (!name || code.length < 6) return jsonError(400, "Ievadi vārdu un atjaunošanas kodu.", "invalid");
    const state = await readCurrent();
    if (!state) return jsonError(409, "Spēle vēl nav izveidota.", "not_ready");
    const hash = sha256(code);
    const wanted = name.toLocaleLowerCase("lv");
    const player = state.players.find(
      (item) =>
        !item.removed &&
        item.recoveryHash === hash &&
        (item.publicName.toLocaleLowerCase("lv") === wanted || item.name.toLocaleLowerCase("lv") === wanted),
    );
    if (!player) return jsonError(401, "Vārds un kods nesakrīt.", "auth");
    const secret = randomToken();
    const result = await mutate({ type: "rotate_session", playerId: player.id, sessionHash: sha256(secret) }, serverCtx());
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    const token = playerCookie(player.id, secret);
    const jar = await cookies();
    jar.set("mk_player", token, cookieOptions(60 * 60 * 36));
    return Response.json({ publicName: player.publicName, token });
  });
}
