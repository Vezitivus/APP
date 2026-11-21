import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, PIN_ITERATIONS, verifyPin } from "../src/lib/auth/pin";
import { isPinLocked, normalizeGame } from "../src/lib/game/engine";
import type { GameState, Player } from "../src/lib/game/types";

describe("PIN", () => {
  it("pieņem tikai četrus ciparus", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("12 4")).toBe(false);
  });

  it("saglabā sālītu PBKDF2 un pārbauda to bez teksta saglabāšanas", async () => {
    const stored = await hashPin("2468");
    expect(stored.startsWith(`pbkdf2$sha256$${PIN_ITERATIONS}$`)).toBe(true);
    expect(stored).not.toContain("2468");
    expect(await verifyPin("2468", stored)).toBe(true);
    expect(await verifyPin("2469", stored)).toBe(false);
    expect(await verifyPin("0000", stored)).toBe(false);
    expect(await verifyPin("2468", "old-sha256-recovery-hash")).toBe(false);
    const other = await hashPin("2468");
    expect(other).not.toBe(stored);
    expect(await verifyPin("2468", other)).toBe(true);
  });
});

describe("spēles PIN stāvoklis", () => {
  it("pārceļ veco recoveryHash un aizpilda bloķēšanas laukus", () => {
    const state = normalizeGame({
      players: [
        {
          id: "p1",
          name: "Anna",
          publicName: "Anna",
          sessionHash: "s",
          recoveryHash: "legacy",
          callCount: 0,
          eligible: true,
          removed: false,
          lastSeenAt: null,
          createdAt: "t",
        } as unknown as Player,
      ],
    } as GameState);
    expect(state.players[0].pinHash).toBe("legacy");
    expect(state.players[0].pinFailedAttempts).toBe(0);
    expect(state.players[0].pinLockedUntil).toBeNull();
    expect("recoveryHash" in state.players[0]).toBe(false);
  });

  it("uzskata PIN par bloķētu tikai kamēr termiņš nav beidzies", () => {
    const player = {
      pinLockedUntil: new Date(1_000).toISOString(),
    } as Player;
    expect(isPinLocked(player, 500)).toBe(true);
    expect(isPinLocked(player, 1_000)).toBe(false);
    expect(isPinLocked({ ...player, pinLockedUntil: null }, 500)).toBe(false);
  });
});
