import { describe, expect, it } from "vitest";
import {
  CROSSFADE_BLUR_PX,
  CROSSFADE_SECONDS,
  PLAYBACK_TRANSFORM,
  SWAP_LEAD_SECONDS,
  cloudinaryPlaybackUrl,
  crossfadeStyle,
  lastFrameTime,
  nextBufferUrl,
  nextBufferUrls,
  remainingSeconds,
  sameMediaUrl,
  shouldPrerollSwap,
} from "../src/lib/tv/playback";

const TRANSFORM = PLAYBACK_TRANSFORM;

describe("TV atskaņošanas URL un pārslēgšana", () => {
  it("Cloudinary video adresei pievieno fiksētu mp4/h264 transformāciju un to nedublē", () => {
    expect(TRANSFORM).toBe("f_mp4,vc_h264,q_auto");
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/v1795253902/1.mp4")).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/v1795253902/1.mp4`,
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/izsaukums_look.mp4")).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/izsaukums_look.mp4`,
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/v1/1.mp4")).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/v1/1.mp4`,
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/q_auto,f_auto/v1/1.mp4")).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/v1/1.mp4`,
    );
    expect(cloudinaryPlaybackUrl(`https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/v1/1.mp4`)).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/v1/1.mp4`,
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/v1/1.mp4", { start: 0.4, end: 14.8 })).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM},so_0.4,eo_14.8/v1/1.mp4`,
    );
    expect(cloudinaryPlaybackUrl("https://cdn.example/clip.mp4")).toBe("https://cdn.example/clip.mp4");
    expect(cloudinaryPlaybackUrl(null)).toBeNull();
    expect(sameMediaUrl("https://res.cloudinary.com/inbickbf/video/upload/v1/1.mp4", `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/v1/1.mp4`)).toBe(
      true,
    );
    expect(sameMediaUrl("https://res.cloudinary.com/inbickbf/video/upload/v1/1.mp4", "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/v1/1.mp4")).toBe(
      true,
    );
    expect(sameMediaUrl("https://res.cloudinary.com/inbickbf/video/upload/v1/1.mp4", "https://res.cloudinary.com/inbickbf/video/upload/v1/2.mp4")).toBe(false);
  });

  it("nākamo klipu sāk gatavot pirms beigām un tur pēdējo kadru", () => {
    expect(shouldPrerollSwap(4.85, 5, 0.2)).toBe(true);
    expect(shouldPrerollSwap(4.6, 5, 0.2)).toBe(false);
    expect(shouldPrerollSwap(0.15, 0.3, SWAP_LEAD_SECONDS)).toBe(true);
    expect(SWAP_LEAD_SECONDS).toBeGreaterThan(CROSSFADE_SECONDS);
    expect(crossfadeStyle(0, "incoming")).toEqual({ opacity: 0, blur: CROSSFADE_BLUR_PX });
    expect(crossfadeStyle(1, "incoming")).toEqual({ opacity: 1, blur: 0 });
    expect(crossfadeStyle(0, "outgoing")).toEqual({ opacity: 1, blur: 0 });
    expect(crossfadeStyle(1, "outgoing")).toEqual({ opacity: 0, blur: CROSSFADE_BLUR_PX });
    expect(crossfadeStyle(0.5, "incoming").opacity).toBeCloseTo(0.5);
    expect(crossfadeStyle(0.5, "incoming").blur).toBeCloseTo(CROSSFADE_BLUR_PX / 2);
    expect(shouldPrerollSwap(Number.NaN, 5)).toBe(false);
    expect(remainingSeconds(4.2, 5)).toBeCloseTo(0.8);
    expect(remainingSeconds(1, Number.NaN)).toBeNull();
    expect(lastFrameTime(8)).toBeCloseTo(7.92);
    expect(lastFrameTime(0.02)).toBe(0);
    expect(lastFrameTime(Number.NaN)).toBeNull();
  });

  it("buferei ņem izsaukumu, nākamos divus standby un atvēršanas/beigu klipus", () => {
    expect(nextBufferUrl({ nextUrl: "https://res.cloudinary.com/inbickbf/video/upload/2.mp4", preloadCallUrl: "https://res.cloudinary.com/inbickbf/video/upload/izsaukums_look.mp4" })).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/izsaukums_look.mp4`,
    );
    expect(nextBufferUrl({ nextUrl: "https://res.cloudinary.com/inbickbf/video/upload/2.mp4" })).toBe(
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/2.mp4`,
    );
    expect(nextBufferUrl({})).toBeNull();
    expect(
      nextBufferUrls({
        nextUrl: "https://res.cloudinary.com/inbickbf/video/upload/2.mp4",
        nextNextUrl: "https://res.cloudinary.com/inbickbf/video/upload/3.mp4",
        preloadCallUrl: "https://res.cloudinary.com/inbickbf/video/upload/izsaukums_look.mp4",
        openVideoUrl: "https://res.cloudinary.com/inbickbf/video/upload/special_open.mp4",
        endVideoUrl: "https://res.cloudinary.com/inbickbf/video/upload/special_end.mp4",
      }),
    ).toEqual([
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/izsaukums_look.mp4`,
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/2.mp4`,
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/3.mp4`,
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/special_open.mp4`,
      `https://res.cloudinary.com/inbickbf/video/upload/${TRANSFORM}/special_end.mp4`,
    ]);
  });
});
