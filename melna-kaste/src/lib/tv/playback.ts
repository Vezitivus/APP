/** Insert Cloudinary `f_auto,q_auto` so the TV can start the next clip faster. */
export function cloudinaryPlaybackUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return url;
    const parts = parsed.pathname.split("/");
    const uploadIdx = parts.findIndex((part, index) => part === "upload" && parts[index - 1] === "video");
    if (uploadIdx < 0) return url;
    const after = parts[uploadIdx + 1] ?? "";
    if (after && !/^v\d+$/.test(after) && /(^|,)(f_auto|q_auto)(,|$)/.test(after)) return url;
    parts.splice(uploadIdx + 1, 0, "f_auto,q_auto");
    parsed.pathname = parts.join("/");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function sameMediaUrl(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return cloudinaryPlaybackUrl(left) === cloudinaryPlaybackUrl(right);
}

/** Start the hidden player this many seconds before the current clip ends. */
export const SWAP_LEAD_SECONDS = 0.45;

export function remainingSeconds(currentTime: number, duration: number): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return null;
  return Math.max(0, duration - currentTime);
}

export function shouldPrerollSwap(currentTime: number, duration: number, leadSeconds = SWAP_LEAD_SECONDS): boolean {
  const remaining = remainingSeconds(currentTime, duration);
  if (remaining === null) return false;
  return remaining <= leadSeconds;
}

export function lastFrameTime(duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return Math.max(0, duration - 0.08);
}

export function nextBufferUrl(input: { nextUrl?: string | null; preloadCallUrl?: string | null }): string | null {
  return cloudinaryPlaybackUrl(input.preloadCallUrl || input.nextUrl || null);
}
