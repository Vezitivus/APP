import { Buffer } from "node:buffer";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server/env";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = randomBytes(length);
  return [...raw].map((value) => alphabet[value % alphabet.length]).join("");
}

export function roomCode(): string {
  return randomCode(5);
}

export type SessionPayload =
  | { typ: "admin"; exp: number }
  | { typ: "player"; pid: string; sec: string; exp: number }
  | { typ: "tv"; gid: string; exp: number };

function secret(): string {
  const value = serverEnv("SESSION_SECRET") ?? "";
  if (value.length < 32) throw new Error("SESSION_SECRET nav iestatīts");
  return value;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: string;
  try {
    expected = createHmac("sha256", secret()).update(body).digest("base64url");
  } catch {
    return null;
  }
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function adminPasswordOk(input: string): boolean {
  const expected = serverEnv("ADMIN_PASSWORD") ?? "";
  if (expected.length < 8 || input.length < 1 || input.length > 200) return false;
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function adminConfigured(): boolean {
  return (serverEnv("ADMIN_PASSWORD") ?? "").length >= 8 && (serverEnv("SESSION_SECRET") ?? "").length >= 32;
}
