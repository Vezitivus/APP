import { describe, expect, it } from "vitest";
import {
  SWAP_LEAD_SECONDS,
  cloudinaryPlaybackUrl,
  lastFrameTime,
  nextBufferUrl,
  remainingSeconds,
  sameMediaUrl,
  shouldPrerollSwap,
} from "../src/lib/tv/playback";

describe("TV atskaņošanas URL un pārslēgšana", () => {
  it("Cloudinary video adresei pievieno f_auto,q_auto un to nedublē", () => {
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/v1795253902/1.mp4")).toBe(
      "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/v1795253902/1.mp4",
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/izsaukums_look.mp4")).toBe(
      "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/izsaukums_look.mp4",
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/v1/1.mp4")).toBe(
      "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/v1/1.mp4",
    );
    expect(cloudinaryPlaybackUrl("https://res.cloudinary.com/inbickbf/video/upload/q_auto,f_auto/v1/1.mp4")).toBe(
      "https://res.cloudinary.com/inbickbf/video/upload/q_auto,f_auto/v1/1.mp4",
    );
    expect(cloudinaryPlaybackUrl("https://cdn.example/clip.mp4")).toBe("https://cdn.example/clip.mp4");
    expect(cloudinaryPlaybackUrl(null)).toBeNull();
    expect(sameMediaUrl("https://res.cloudinary.com/inbickbf/video/upload/v1/1.mp4", "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/v1/1.mp4")).toBe(
      true,
    );
    expect(sameMediaUrl("https://res.cloudinary.com/inbickbf/video/upload/v1/1.mp4", "https://res.cloudinary.com/inbickbf/video/upload/v1/2.mp4")).toBe(false);
  });

  it("nākamo klipu sāk gatavot pirms beigām un tur pēdējo kadru", () => {
    expect(shouldPrerollSwap(4.6, 5, 0.45)).toBe(true);
    expect(shouldPrerollSwap(4.0, 5, 0.45)).toBe(false);
    expect(shouldPrerollSwap(0, 0.3, SWAP_LEAD_SECONDS)).toBe(true);
    expect(shouldPrerollSwap(Number.NaN, 5)).toBe(false);
    expect(remainingSeconds(4.2, 5)).toBeCloseTo(0.8);
    expect(remainingSeconds(1, Number.NaN)).toBeNull();
    expect(lastFrameTime(8)).toBeCloseTo(7.92);
    expect(lastFrameTime(0.02)).toBe(0);
    expect(lastFrameTime(Number.NaN)).toBeNull();
  });

  it("buferei ņem izsaukuma video, ja tas ir sagatavots, citādi nākamo standby", () => {
    expect(nextBufferUrl({ nextUrl: "https://res.cloudinary.com/inbickbf/video/upload/2.mp4", preloadCallUrl: "https://res.cloudinary.com/inbickbf/video/upload/izsaukums_look.mp4" })).toBe(
      "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/izsaukums_look.mp4",
    );
    expect(nextBufferUrl({ nextUrl: "https://res.cloudinary.com/inbickbf/video/upload/2.mp4" })).toBe(
      "https://res.cloudinary.com/inbickbf/video/upload/f_auto,q_auto/2.mp4",
    );
    expect(nextBufferUrl({})).toBeNull();
  });
});
