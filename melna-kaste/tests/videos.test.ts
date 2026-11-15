import { describe, expect, it } from "vitest";
import { cardById } from "../src/lib/game/cards";
import { isCloudinaryDeliveryUrl, resolveCallVideo, standbyPlaylist } from "../src/lib/game/videos";
import { video } from "./helpers";

describe("video piesaiste", () => {
  it("standby vienmēr ir ciparu secībā, nevis nejauši", () => {
    const playlist = standbyPlaylist([
      video({ folder: "standby", filename: "standby_10.mp4" }),
      video({ folder: "standby", filename: "standby_02.mp4" }),
      video({ folder: "standby", filename: "notes.mp4" }),
      video({ folder: "calls", filename: "standby_01.mp4" }),
      video({ folder: "standby", filename: "standby_01.mp4" }),
    ]);
    expect(playlist.map((item) => item.filename)).toEqual(["standby_01.mp4", "standby_02.mp4", "standby_10.mp4"]);
  });

  it("izmanto uzdevuma, tad kategorijas, tad universālo video", () => {
    const card = cardById("look")!;
    expect(resolveCallVideo(card, []).level).toBe("none");
    expect(resolveCallVideo(card, [video({ folder: "calls", filename: "izsaukums_any.mp4" })]).level).toBe("universal");
    expect(resolveCallVideo(card, [video({ folder: "calls", filename: "izsaukums_flash.mp4" })]).level).toBe("category");
    const task = resolveCallVideo(card, [
      video({ folder: "calls", filename: "izsaukums_any.mp4" }),
      video({ folder: "calls", filename: "izsaukums_look.mp4", url: "https://res.cloudinary.com/demo/video/upload/look.mp4" }),
    ]);
    expect(task.level).toBe("task");
    expect(task.video?.filename).toBe("izsaukums_look.mp4");
  });

  it("duelis nekrīt uz citas kartītes nosaukuma video", () => {
    const duel = cardById("duel")!;
    const resolved = resolveCallVideo(duel, [video({ folder: "calls", filename: "izsaukums_choice.mp4" })]);
    expect(resolved.level).toBe("none");
    expect(duel.categoryVideoFile).toBeNull();
  });

  it("slepenā misija izmanto kopējo misijas video, nevis konkrētas misijas nosaukumu", () => {
    const mission = cardById("mission_04")!;
    expect(mission.videoFile).toBe("izsaukums_mission.mp4");
    expect(mission.summary).toContain("smieklīgu atgadījumu");
  });

  it("pieņem tikai sava Cloudinary mākoņa HTTPS adreses", () => {
    expect(isCloudinaryDeliveryUrl("https://res.cloudinary.com/mana-kaste/video/upload/v1/a.mp4", "mana-kaste")).toBe(true);
    expect(isCloudinaryDeliveryUrl("http://res.cloudinary.com/mana-kaste/video/upload/a.mp4", "mana-kaste")).toBe(false);
    expect(isCloudinaryDeliveryUrl("https://evil.example/mana-kaste/a.mp4", "mana-kaste")).toBe(false);
    expect(isCloudinaryDeliveryUrl("javascript:alert(1)", "mana-kaste")).toBe(false);
  });
});
