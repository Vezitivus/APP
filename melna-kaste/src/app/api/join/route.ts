import { cookies } from "next/headers";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { limit, mutate, readCurrent } from "@/lib/db/repository";
import { sanitizeName } from "@/lib/game/engine";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { cookieOptions, playerCookie, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return asResponse(async () => {
    await limit(`join:${clientIp(request)}`, 30, 10 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { name?: string; code?: string } | null;
    const name = sanitizeName(body?.name ?? "");
    if (!name) return jsonError(400, "Ievadi vārdu, līdz 24 simboliem.", "invalid");
    const state = await readCurrent();
    if (!state) return jsonError(409, "Spēle vēl nav izveidota.", "not_ready");
    if (state.phase === "FINISHED") return jsonError(409, "Spēle ir pabeigta.", "finished");
    if (!state.joinOpen) return jsonError(409, "Pievienošanās tagad nav atvērta.", "not_ready");
    const code = (body?.code ?? "").trim().toUpperCase();
    if (code && code !== state.code) return jsonError(404, "Spēles kods nav pareizs.", "code");
    const secret = randomToken();
    const { randomCode } = await import("@/lib/auth/crypto");
    const recoveryCode = randomCode();
    const ctx = serverCtx();
    const result = await mutate(
      { type: "add_player", name, sessionHash: sha256(secret), recoveryHash: sha256(recoveryCode) },
      ctx,
    );
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    const player = result.state.players.find((item) => item.sessionHash === sha256(secret));
    if (!player) return jsonError(500, "Dalībnieku neizdevās reģistrēt.", "server");
    const token = playerCookie(player.id, secret);
    const jar = await cookies();
    jar.set("mk_player", token, cookieOptions(60 * 60 * 36));
    return Response.json({ publicName: player.publicName, recoveryCode, token });
  });
}
