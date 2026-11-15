import { cookies } from "next/headers";
import { adminConfigured, readSession, sha256, signSession, type SessionPayload } from "@/lib/auth/crypto";
import { afterTick, readCurrent } from "@/lib/db/repository";
import type { Ctx, GameState, Player } from "@/lib/game/types";

export function serverCtx(now = Date.now()): Ctx {
  return { now, rng: () => Math.random(), id: () => crypto.randomUUID() };
}

export async function tickedState(): Promise<GameState | null> {
  return afterTick(serverCtx());
}

export async function requireAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const jar = await cookies();
  const session = readSession(jar.get("mk_admin")?.value);
  return session?.typ === "admin";
}

export function adminCookie(expMs = 1000 * 60 * 60 * 12): string {
  return signSession({ typ: "admin", exp: Date.now() + expMs });
}

export function playerCookie(playerId: string, secret: string): string {
  const payload: SessionPayload = { typ: "player", pid: playerId, sec: secret, exp: Date.now() + 1000 * 60 * 60 * 36 };
  return signSession(payload);
}

export function tvCookie(gameId: string): string {
  return signSession({ typ: "tv", gid: gameId, exp: Date.now() + 1000 * 60 * 60 * 18 });
}

export function cookieOptions(maxAge: number) {
  const origin = process.env.PUBLIC_URL ?? "";
  const secure = origin ? origin.startsWith("https://") : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

export async function currentPlayer(request: Request): Promise<{ player: Player; state: GameState } | null> {
  const jar = await cookies();
  const raw = jar.get("mk_player")?.value || request.headers.get("x-player-token");
  const session = readSession(raw);
  if (!session || session.typ !== "player") return null;
  const state = await readCurrent();
  if (!state) return null;
  const player = state.players.find((item) => item.id === session.pid && !item.removed);
  if (!player || player.sessionHash !== sha256(session.sec)) return null;
  return { player, state };
}

export async function pairedTv(): Promise<boolean> {
  const state = await readCurrent();
  if (!state) return false;
  const jar = await cookies();
  const session = readSession(jar.get("mk_tv")?.value);
  return session?.typ === "tv" && session.gid === state.id;
}
