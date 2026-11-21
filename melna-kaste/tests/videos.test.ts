import { describe, expect, it } from "vitest";
import { cardById } from "../src/lib/game/cards";
import { classifyCloudinaryAsset, filenameForCloudinaryAsset, filenameFromPublicId, folderHintFromPath, isCloudinaryDeliveryUrl, resolveCallVideo, standbyPlaylist, standbySlots } from "../src/lib/game/videos";
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

  it("ciparu vārdi 1…20 ir secībā, un vecais vārds aizpilda tukšu vietu", () => {
    const playlist = standbyPlaylist([
      video({ folder: "standby", filename: "10.mp4" }),
      video({ folder: "standby", filename: "2.mp4" }),
      video({ folder: "standby", filename: "1.mp4" }),
      video({ folder: "standby", filename: "standby_01.mp4" }),
      video({ folder: "standby", filename: "standby_03.mp4" }),
      video({ folder: "standby", filename: "21.mp4" }),
      video({ folder: "standby", filename: "notes.mp4" }),
      video({ folder: "calls", filename: "4.mp4" }),
    ]);
    expect(playlist.map((item) => item.filename)).toEqual(["1.mp4", "2.mp4", "standby_03.mp4", "10.mp4"]);
    const slots = standbySlots([
      video({ folder: "standby", filename: "10.mp4" }),
      video({ folder: "standby", filename: "01.mp4" }),
    ]);
    expect(slots).toHaveLength(20);
    expect(slots.filter((slot) => slot.present).map((slot) => slot.slot)).toEqual([1, 10]);
    expect(slots[0]).toMatchObject({ slot: 1, present: true, filename: "01.mp4", expectedFilename: "1.mp4" });
    expect(slots[1]).toMatchObject({ slot: 2, present: false, filename: null, expectedFilename: "2.mp4" });
    expect(slots[19].slot).toBe(20);
    expect(filenameFromPublicId("melna-kaste/standby/1")).toBe("1.mp4");
    expect(filenameFromPublicId("melna-kaste/standby/10")).toBe("10.mp4");
    expect(filenameFromPublicId("melna-kaste/standby/standby_01")).toBe("standby_01.mp4");
    expect(filenameFromPublicId("melna-kaste/standby/..")).toBeNull();
  });

  it("pazīst kataloga vārdu arī ar Cloudinary nejaušo piedēkli", () => {
    expect(filenameForCloudinaryAsset("standby", { displayName: "1", publicId: "1_xk3abc" })).toBe("1.mp4");
    expect(filenameForCloudinaryAsset("standby", { displayName: "1.mp4", publicId: "8jsb1xofxdqamu2rzwt9q" })).toBe("1.mp4");
    expect(filenameForCloudinaryAsset("standby", { publicId: "10_abc123" })).toBe("10.mp4");
    expect(filenameForCloudinaryAsset("standby", { publicId: "1_abc123" })).toBe("1.mp4");
    expect(filenameForCloudinaryAsset("standby", { displayName: "standby_01_q8m2", originalFilename: "standby_01" })).toBe("standby_01.mp4");
    expect(filenameForCloudinaryAsset("standby", { publicId: "21_abc123" })).toBe("21_abc123.mp4");
    expect(filenameForCloudinaryAsset("standby", { publicId: "melna-kaste/standby/.." })).toBeNull();

    expect(filenameForCloudinaryAsset("calls", { publicId: "izsaukums_flash_x7k2" })).toBe("izsaukums_flash.mp4");
    expect(filenameForCloudinaryAsset("calls", { displayName: "izsaukums_flash_x7k2", originalFilename: "izsaukums_flash" })).toBe("izsaukums_flash.mp4");
    expect(filenameForCloudinaryAsset("calls", { displayName: "izsaukums_sales_pitch", publicId: "rnd" })).toBe("izsaukums_sales_pitch.mp4");
    expect(filenameForCloudinaryAsset("calls", { publicId: "izsaukums_sales_pitch_x7k2" })).toBe("izsaukums_sales_pitch.mp4");
    expect(filenameForCloudinaryAsset("calls", { publicId: "izsaukums_bad_lawyer_q9zz" })).toBe("izsaukums_bad_lawyer.mp4");
    expect(filenameForCloudinaryAsset("calls", { publicId: "izsaukums_three_in_five_x7k2" })).toBe("izsaukums_three_in_five.mp4");
    expect(filenameForCloudinaryAsset("calls", { displayName: "rndpublic", originalFilename: "izsaukums_my_party", publicId: "rndpublic" })).toBe(
      "izsaukums_my_party.mp4",
    );
    expect(filenameForCloudinaryAsset("special", { displayName: "special_global_vote_ab12cd" })).toBe("special_global_vote.mp4");
    expect(filenameForCloudinaryAsset("special", { publicId: "melna-kaste/special/special_open" })).toBe("special_open.mp4");
  });

  it("vienā mapē šķiro video pēc vārda, nevis pēc apakšmapes", () => {
    expect(folderHintFromPath("melna-kaste")).toBeNull();
    expect(folderHintFromPath("melna-kaste/standby")).toBe("standby");
    expect(folderHintFromPath("melna-kaste/calls/izsaukums_flash")).toBe("calls");
    expect(folderHintFromPath("melna-kaste/special")).toBe("special");

    expect(classifyCloudinaryAsset({ displayName: "1", publicId: "1_xk3abc" })).toEqual({ folder: "standby", filename: "1.mp4" });
    expect(classifyCloudinaryAsset({ displayName: "10.mp4", publicId: "rnd" })).toEqual({ folder: "standby", filename: "10.mp4" });
    expect(classifyCloudinaryAsset({ originalFilename: "standby_02", publicId: "aa11" })).toEqual({ folder: "standby", filename: "standby_02.mp4" });
    expect(classifyCloudinaryAsset({ publicId: "10_abc123" })).toEqual({ folder: "standby", filename: "10.mp4" });
    expect(classifyCloudinaryAsset({ displayName: "izsaukums_flash_x7k2", originalFilename: "izsaukums_flash" })).toEqual({
      folder: "calls",
      filename: "izsaukums_flash.mp4",
    });
    expect(classifyCloudinaryAsset({ displayName: "special_global_vote_ab12cd", originalFilename: "special_global_vote" })).toEqual({
      folder: "special",
      filename: "special_global_vote.mp4",
    });
    expect(classifyCloudinaryAsset({ displayName: "special_open", publicId: "rnd" })).toEqual({ folder: "special", filename: "special_open.mp4" });
    expect(classifyCloudinaryAsset({ originalFilename: "izsaukums_my_party", publicId: "rndpublic" })).toEqual({
      folder: "calls",
      filename: "izsaukums_my_party.mp4",
    });
    expect(classifyCloudinaryAsset({ displayName: "upload_test_delete_me", publicId: "unknown" })).toBeNull();
    expect(classifyCloudinaryAsset({ publicId: "21_abc123" })).toBeNull();
    expect(classifyCloudinaryAsset({ publicId: "21_abc123" }, "standby")).toEqual({ folder: "standby", filename: "21_abc123.mp4" });
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
