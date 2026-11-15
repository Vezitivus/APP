import { isPlayable } from "./cards";
import type { AutoCategory, CardDef, Player } from "./types";

/** Higher weight for people who have been called less often than the busiest eligible guest. */
export function callWeight(callCount: number, minCalls: number): number {
  const gap = Math.max(0, callCount - minCalls);
  return 1 / (gap + 1) ** 2;
}

export function weightedPick<T>(items: T[], weightOf: (item: T) => number, rng: () => number): T {
  if (items.length === 0) throw new Error("weightedPick saņēma tukšu sarakstu");
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  let roll = rng() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items[items.length - 1];
}

export function activePlayers(players: Player[]): Player[] {
  return players.filter((player) => !player.removed);
}

export function eligiblePlayers(players: Player[]): Player[] {
  return players.filter((player) => !player.removed && player.eligible);
}

export function uniquePublicName(name: string, players: Player[]): string {
  const taken = new Set(players.filter((player) => !player.removed).map((player) => player.publicName.toLocaleLowerCase("lv")));
  if (!taken.has(name.toLocaleLowerCase("lv"))) return name;
  let suffix = 2;
  while (taken.has(`${name} ${suffix}`.toLocaleLowerCase("lv"))) suffix += 1;
  return `${name} ${suffix}`;
}

export function pickPlayer(players: Player[], rng: () => number, exceptId?: string | null): Player | null {
  const pool = eligiblePlayers(players).filter((player) => player.id !== exceptId);
  if (pool.length === 0) return null;
  const minCalls = Math.min(...pool.map((player) => player.callCount));
  return weightedPick(pool, (player) => callWeight(player.callCount, minCalls), rng);
}

export function pickExtras(players: Player[], primaryId: string, count: number, rng: () => number): Player[] {
  const chosen: Player[] = [];
  const blocked = new Set([primaryId]);
  for (let index = 0; index < count; index += 1) {
    const pool = eligiblePlayers(players).filter((player) => !blocked.has(player.id));
    if (pool.length === 0) break;
    const minCalls = Math.min(...pool.map((player) => player.callCount));
    const next = weightedPick(pool, (player) => callWeight(player.callCount, minCalls), rng);
    chosen.push(next);
    blocked.add(next.id);
  }
  return chosen;
}

export function playableCards(cards: CardDef[], category: CardDef["category"], eligibleCount: number): CardDef[] {
  return cards.filter((card) => card.category === category && isPlayable(card, eligibleCount));
}

export function pickCategory(
  weights: Record<AutoCategory, number>,
  active: AutoCategory[],
  cards: CardDef[],
  eligibleCount: number,
  rng: () => number,
): AutoCategory | null {
  const available = active.filter(
    (category) => (weights[category] ?? 0) > 0 && playableCards(cards, category, eligibleCount).length > 0,
  );
  if (available.length === 0) return null;
  return weightedPick(available, (category) => weights[category] ?? 0, rng);
}

export function pickCardFromCategory(
  cards: CardDef[],
  category: CardDef["category"],
  eligibleCount: number,
  used: string[],
  rng: () => number,
): { card: CardDef; used: string[] } | null {
  const pool = playableCards(cards, category, eligibleCount);
  if (pool.length === 0) return null;
  const fresh = pool.filter((card) => !used.includes(card.id));
  const source = fresh.length > 0 ? fresh : pool;
  const nextUsed = fresh.length > 0 ? used : [];
  const card = source[Math.floor(rng() * source.length)];
  return { card, used: [...nextUsed, card.id] };
}
