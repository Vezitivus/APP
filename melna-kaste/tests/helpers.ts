import { apply, createGame, type GameState } from "../src/lib/game/engine";
import type { Action, Ctx, VideoAsset } from "../src/lib/game/types";

let sequence = 0;

export function ids(prefix = "id"): () => string {
  return () => `${prefix}-${sequence++}`;
}

export function ctx(now = 1_700_000_000_000, rng: () => number = () => 0): Ctx {
  return { now, rng, id: ids("n") };
}

export function game(now = 1_700_000_000_000): GameState {
  return createGame({ id: "game-1", code: "ABCD", now });
}

export function act(state: GameState, action: Action, current = ctx()) {
  const result = apply(state, action, current);
  if (result.error) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

export function addPair(state: GameState, now = 1_700_000_000_000) {
  let next = act(state, { type: "activate" }, ctx(now, () => 0)).state;
  next = act(next, { type: "add_player", name: "Anna", sessionHash: "hash-a", recoveryHash: "rec-a" }, ctx(now, () => 0)).state;
  next = act(next, { type: "add_player", name: "Anna", sessionHash: "hash-b", recoveryHash: "rec-b" }, ctx(now, () => 0)).state;
  return next;
}

export function video(partial: Partial<VideoAsset> & Pick<VideoAsset, "filename" | "folder">): VideoAsset {
  return {
    id: partial.filename,
    publicId: `melna-kaste/${partial.folder}/${partial.filename.replace(/\.mp4$/i, "")}`,
    folder: partial.folder,
    filename: partial.filename,
    url: partial.url ?? `https://res.cloudinary.com/demo/video/upload/${partial.filename}`,
    bytes: partial.bytes ?? 1000,
    width: partial.width ?? 1920,
    height: partial.height ?? 1080,
    durationSeconds: partial.durationSeconds ?? null,
  };
}

export function standby(count: number): VideoAsset[] {
  return Array.from({ length: count }, (_, index) =>
    video({ folder: "standby", filename: `standby_${String(index + 1).padStart(2, "0")}.mp4`, durationSeconds: 5 + index * 3 }),
  );
}
