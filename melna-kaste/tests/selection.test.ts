import { describe, expect, it } from "vitest";
import { callWeight, pickCardFromCategory, pickPlayer, uniquePublicName, weightedPick } from "../src/lib/game/selection";
import { catalog } from "../src/lib/game/cards";
import { mulberry32 } from "./rng";
import type { Player } from "../src/lib/game/types";

function player(id: string, callCount: number): Player {
  return {
    id,
    name: id,
    publicName: id,
    sessionHash: "x",
    pinHash: "y",
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    callCount,
    eligible: true,
    removed: false,
    lastSeenAt: null,
    createdAt: "t",
  };
}

describe("dalībnieku atlase", () => {
  it("dod lielāku svaru tiem, kas izsaukti retāk", () => {
    expect(callWeight(0, 0)).toBe(1);
    expect(callWeight(1, 0)).toBeCloseTo(1 / 4);
    expect(callWeight(2, 0)).toBeCloseTo(1 / 9);
  });

  it("retāk izsauktais tiek izvēlēts biežāk", () => {
    const people = [player("reta", 0), player("videja", 3), player("bieza", 6)];
    const rng = mulberry32(7);
    const counts = { reta: 0, videja: 0, bieza: 0 };
    for (let i = 0; i < 2000; i += 1) {
      const picked = pickPlayer(people, rng);
      counts[picked!.id as "reta"] += 1;
    }
    expect(counts.reta).toBeGreaterThan(1500);
    expect(counts.reta).toBeGreaterThan(counts.videja);
    expect(counts.videja).toBeGreaterThan(counts.bieza);
  });

  it("neizvēlas izņemtu vai no izsaukumiem izslēgtu cilvēku", () => {
    const quiet = player("a", 0);
    quiet.removed = true;
    const blocked = player("b", 0);
    blocked.eligible = false;
    const only = pickPlayer([quiet, blocked, player("c", 9)], () => 0.99);
    expect(only?.id).toBe("c");
  });

  it("publiskie vārdi nepaliek vienādi", () => {
    const existing = [player("1", 0)];
    existing[0].publicName = "Anna";
    expect(uniquePublicName("Anna", existing)).toBe("Anna 2");
    existing.push({ ...player("2", 0), publicName: "Anna 2" });
    expect(uniquePublicName("anna", existing)).toBe("anna 3");
  });

  it("kategorijas kartītes neatkārtojas, kamēr nav izmantotas pārējās", () => {
    const flash = catalog().filter((card) => card.category === "FLASH" && card.minPlayers === 1);
    let used: string[] = [];
    const seen: string[] = [];
    const rng = () => 0;
    for (let i = 0; i < flash.length; i += 1) {
      const picked = pickCardFromCategory(catalog(), "FLASH", 1, used, rng);
      expect(picked).not.toBeNull();
      expect(seen).not.toContain(picked!.card.id);
      seen.push(picked!.card.id);
      used = picked!.used;
    }
    const again = pickCardFromCategory(catalog(), "FLASH", 1, used, rng);
    expect(again!.used).toHaveLength(1);
    expect(flash.map((card) => card.id)).toContain(again!.card.id);
  });

  it("ar diviem dalībniekiem neņem kartīti, kurai vajag vairāk cilvēku", () => {
    const cards = catalog();
    const tooBig = cards.find((card) => card.id === "sales_pitch")!;
    expect(pickCardFromCategory([tooBig], "FLASH", 1, [], () => 0)).toBeNull();
    expect(pickCardFromCategory(cards, "TEAM", 2, [], () => 0)?.card.category).toBe("TEAM");
  });

  it("weightedPick nenokrīt, ja visi svari ir nulle", () => {
    expect(weightedPick(["a", "b"], () => 0, () => 0)).toBe("a");
  });
});
