/** Fixed MP4/H.264 delivery. Avoid `f_auto`: the first request transcodes and can stall longer than the crossfade. */
export const PLAYBACK_TRANSFORM = "f_mp4,vc_h264,q_auto";

/** Start the incoming clip this many seconds before the current clip ends, then fade for CROSSFADE_SECONDS. */
export const SWAP_LEAD_SECONDS = 0.35;
export const CROSSFADE_SECONDS = 0.2;
export const CROSSFADE_BLUR_PX = 8;

function isVersionToken(part: string): boolean {
  return /^v\d+$/.test(part);
}

function isTransformToken(part: string): boolean {
  if (!part || isVersionToken(part)) return false;
  return /(^|,)(f_auto|f_mp4|q_auto|vc_h264|vc_auto|so_|eo_)/.test(part);
}

function uploadIndex(parts: string[]): number {
  return parts.findIndex((part, index) => part === "upload" && parts[index - 1] === "video");
}

function formatOffset(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function cloudinaryPlaybackUrl(
  url: string | null | undefined,
  trim?: { start?: number | null; end?: number | null },
): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return url;
    const parts = parsed.pathname.split("/");
    const uploadIdx = uploadIndex(parts);
    if (uploadIdx < 0) return url;
    const after = parts[uploadIdx + 1] ?? "";
    if (after && isTransformToken(after)) parts.splice(uploadIdx + 1, 1);
    const bits = [PLAYBACK_TRANSFORM];
    if (trim?.start && Number.isFinite(trim.start) && trim.start > 0.001) bits.push(`so_${formatOffset(trim.start)}`);
    if (trim?.end && Number.isFinite(trim.end) && trim.end > 0.001) bits.push(`eo_${formatOffset(trim.end)}`);
    parts.splice(uploadIdx + 1, 0, bits.join(","));
    parsed.pathname = parts.join("/");
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Compare two delivery URLs ignoring the playback transform segment. */
export function deliveryKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = cloudinaryPlaybackUrl(url) ?? url;
  try {
    const parsed = new URL(normalized);
    const parts = parsed.pathname.split("/");
    const uploadIdx = uploadIndex(parts);
    if (uploadIdx >= 0) {
      const after = parts[uploadIdx + 1] ?? "";
      if (after && isTransformToken(after)) parts.splice(uploadIdx + 1, 1);
    }
    parsed.pathname = parts.join("/");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return normalized;
  }
}

export function sameMediaUrl(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = deliveryKey(left);
  const b = deliveryKey(right);
  return Boolean(a && b && a === b);
}

export function remainingSeconds(currentTime: number, duration: number): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return null;
  return Math.max(0, duration - currentTime);
}

export function shouldPrerollSwap(currentTime: number, duration: number, leadSeconds = SWAP_LEAD_SECONDS): boolean {
  const remaining = remainingSeconds(currentTime, duration);
  if (remaining === null) return false;
  return remaining <= leadSeconds;
}

/** progress 0 = fade start, 1 = fade done. */
export function crossfadeStyle(progress: number, role: "incoming" | "outgoing"): { opacity: number; blur: number } {
  const p = Math.min(1, Math.max(0, progress));
  if (role === "incoming") return { opacity: p, blur: (1 - p) * CROSSFADE_BLUR_PX };
  return { opacity: 1 - p, blur: p * CROSSFADE_BLUR_PX };
}

export function applyCrossfadeStyle(element: { style: { opacity: string; filter: string } }, opacity: number, blur: number) {
  element.style.opacity = String(opacity);
  element.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
}

export function lastFrameTime(duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return Math.max(0, duration - 0.08);
}

export function nextBufferUrl(input: { nextUrl?: string | null; preloadCallUrl?: string | null }): string | null {
  return nextBufferUrls(input)[0] ?? null;
}

export function nextBufferUrls(input: {
  nextUrl?: string | null;
  nextNextUrl?: string | null;
  preloadCallUrl?: string | null;
  openVideoUrl?: string | null;
  endVideoUrl?: string | null;
}): string[] {
  const ordered = [input.preloadCallUrl, input.nextUrl, input.nextNextUrl, input.openVideoUrl, input.endVideoUrl];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ordered) {
    const url = cloudinaryPlaybackUrl(raw);
    const key = deliveryKey(url);
    if (!url || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}
