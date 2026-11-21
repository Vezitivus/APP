import { catalog } from "./cards";
import type { CardDef, VideoAsset, VideoLevel } from "./types";

/** Main names are `1.mp4` … `20.mp4`. `standby_01.mp4` still fills the same slot. */
const NUMERIC_FILE = /^(\d{1,3})\.mp4$/i;
const LEGACY_FILE = /^standby_(\d{2,3})\.mp4$/i;
export const STANDBY_SLOT_COUNT = 20;
export const UNIVERSAL_CALL = "izsaukums_any.mp4";

export interface ResolvedVideo {
  video: VideoAsset | null;
  level: VideoLevel;
}

export interface StandbySlot {
  slot: number;
  expectedFilename: string;
  present: boolean;
  filename: string | null;
  kind: "numeric" | "legacy" | null;
}

interface ChosenStandby {
  video: VideoAsset;
  kind: "numeric" | "legacy";
  rank: number;
}

export function standbySlotOf(filename: string): { slot: number; kind: "numeric" | "legacy" } | null {
  const numeric = NUMERIC_FILE.exec(filename);
  if (numeric) {
    const slot = Number(numeric[1]);
    if (slot >= 1 && slot <= STANDBY_SLOT_COUNT) return { slot, kind: "numeric" };
    return null;
  }
  const legacy = LEGACY_FILE.exec(filename);
  if (legacy) {
    const slot = Number(legacy[1]);
    if (slot >= 1 && slot <= STANDBY_SLOT_COUNT) return { slot, kind: "legacy" };
  }
  return null;
}

/** Unpadded `1.mp4` beats `01.mp4`, which beats `standby_01.mp4`. */
function standbyRank(filename: string): number {
  const numeric = NUMERIC_FILE.exec(filename);
  if (!numeric) return 1;
  return String(Number(numeric[1])) === numeric[1] ? 3 : 2;
}

function chosenStandby(videos: VideoAsset[]): Map<number, ChosenStandby> {
  const chosen = new Map<number, ChosenStandby>();
  for (const video of videos) {
    if (video.folder !== "standby") continue;
    const parsed = standbySlotOf(video.filename);
    if (!parsed) continue;
    const rank = standbyRank(video.filename);
    const current = chosen.get(parsed.slot);
    if (!current || rank > current.rank) chosen.set(parsed.slot, { video, kind: parsed.kind, rank });
  }
  return chosen;
}

/** Present slots in numeric order: 1, 2, 10 — never 1, 10, 2. One file per slot. */
export function standbyPlaylist(videos: VideoAsset[]): VideoAsset[] {
  const chosen = chosenStandby(videos);
  const playlist: VideoAsset[] = [];
  for (let slot = 1; slot <= STANDBY_SLOT_COUNT; slot += 1) {
    const item = chosen.get(slot);
    if (item) playlist.push(item.video);
  }
  return playlist;
}

export function standbySlots(videos: VideoAsset[]): StandbySlot[] {
  const chosen = chosenStandby(videos);
  return Array.from({ length: STANDBY_SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const item = chosen.get(slot);
    return {
      slot,
      expectedFilename: `${slot}.mp4`,
      present: Boolean(item),
      filename: item?.video.filename ?? null,
      kind: item?.kind ?? null,
    };
  });
}

export function standbyNumber(filename: string): number {
  return standbySlotOf(filename)?.slot ?? Number.POSITIVE_INFINITY;
}

/** Cloudinary public id `melna-kaste/standby/1` becomes `1.mp4`. */
export function filenameFromPublicId(publicId: string): string | null {
  const leaf = publicId.split("/").pop() ?? "";
  if (!leaf || leaf.includes("..")) return null;
  return leaf.toLowerCase().endsWith(".mp4") ? leaf : `${leaf}.mp4`;
}

export function findByFilename(videos: VideoAsset[], folder: VideoAsset["folder"], filename: string): VideoAsset | undefined {
  const wanted = filename.toLowerCase();
  return videos.find((video) => video.folder === folder && video.filename.toLowerCase() === wanted);
}

/**
 * Task file, then category file, then universal call.
 * Fallbacks are generic on purpose: they must not announce a different task.
 */
export function resolveCallVideo(card: CardDef, videos: VideoAsset[]): ResolvedVideo {
  if (card.category === "GLOBAL") {
    const special = findByFilename(videos, "special", `special_${card.id}.mp4`);
    if (special) return { video: special, level: "special" };
  }
  const task = findByFilename(videos, "calls", card.videoFile);
  if (task) return { video: task, level: "task" };
  if (card.categoryVideoFile) {
    const category = findByFilename(videos, "calls", card.categoryVideoFile);
    if (category) return { video: category, level: "category" };
  }
  const universal = findByFilename(videos, "calls", UNIVERSAL_CALL);
  if (universal) return { video: universal, level: "universal" };
  return { video: null, level: "none" };
}

export function specialOpen(videos: VideoAsset[]): VideoAsset | null {
  return findByFilename(videos, "special", "special_open.mp4") ?? null;
}

export function specialEnd(videos: VideoAsset[]): VideoAsset | null {
  return findByFilename(videos, "special", "special_end.mp4") ?? null;
}

export interface ExpectedFile {
  folder: "standby" | "calls" | "special";
  filename: string;
  cardId: string | null;
  title: string;
  required: boolean;
}

export function expectedLibrary(custom: CardDef[] = []): ExpectedFile[] {
  const cards = catalog(custom);
  const files: ExpectedFile[] = [
    { folder: "special", filename: "special_open.mp4", cardId: null, title: "Pasākuma sākums", required: false },
    { folder: "special", filename: "special_end.mp4", cardId: null, title: "Pasākuma noslēgums", required: false },
  ];
  const seen = new Set<string>();
  const push = (entry: ExpectedFile) => {
    const key = `${entry.folder}/${entry.filename.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(entry);
  };
  for (const card of cards) {
    push({
      folder: card.category === "GLOBAL" ? "calls" : "calls",
      filename: card.videoFile,
      cardId: card.id,
      title: card.title,
      required: false,
    });
    if (card.category === "GLOBAL") {
      push({
        folder: "special",
        filename: `special_${card.id}.mp4`,
        cardId: card.id,
        title: card.title,
        required: false,
      });
    }
  }
  push({ folder: "calls", filename: UNIVERSAL_CALL, cardId: null, title: "Universālais izsaukums", required: false });
  push({ folder: "calls", filename: "izsaukums_flash.mp4", cardId: null, title: "Ātrais izaicinājums", required: false });
  push({ folder: "calls", filename: "izsaukums_pair.mp4", cardId: null, title: "Divu cilvēku izaicinājums", required: false });
  push({ folder: "calls", filename: "izsaukums_team.mp4", cardId: null, title: "Komandas izaicinājums", required: false });
  return files;
}

export function isCloudinaryDeliveryUrl(url: string, cloudName: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${cloudName}/`)
    );
  } catch {
    return false;
  }
}
