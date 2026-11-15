import { catalog } from "./cards";
import type { CardDef, VideoAsset, VideoLevel } from "./types";

const STANDBY_FILE = /^standby_(\d{2,3})\.mp4$/i;
export const UNIVERSAL_CALL = "izsaukums_any.mp4";

export interface ResolvedVideo {
  video: VideoAsset | null;
  level: VideoLevel;
}

export function standbyPlaylist(videos: VideoAsset[]): VideoAsset[] {
  return videos
    .filter((video) => video.folder === "standby" && STANDBY_FILE.test(video.filename))
    .sort((a, b) => standbyNumber(a.filename) - standbyNumber(b.filename));
}

export function standbyNumber(filename: string): number {
  const match = STANDBY_FILE.exec(filename);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
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
