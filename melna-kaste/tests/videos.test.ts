import { describe, expect, it } from "vitest";
import { cardById } from "../src/lib/game/cards";
import { classifyCloudinaryAsset, expectedLibrary, expectedPresence, filenameForCloudinaryAsset, filenameFromPublicId, folderHintFromPath, isCloudinaryDeliveryUrl, resolveCallVideo, standbyPlaylist, standbySlots } from "../src/lib/game/videos";
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

  it("brīvā izvēle un brīvais duelis vairs nav katalogā", () => {
    expect(cardById("choice")).toBeUndefined();
    expect(cardById("duel")).toBeUndefined();
    const names = expectedLibrary().map((file) => file.filename);
    expect(names).not.toContain("izsaukums_choice.mp4");
    expect(names).not.toContain("izsaukums_duel.mp4");
  });

  it("kopīgais notikums ir klāt, ja ir special vai izsaukuma variants", () => {
    const vote = expectedLibrary().find((file) => file.cardId === "global_vote");
    expect(vote).toMatchObject({ filename: "special_global_vote.mp4" });
    expect(vote?.alternates).toEqual([{ folder: "calls", filename: "izsaukums_global_vote.mp4" }]);
    expect(expectedPresence(vote!, [video({ folder: "special", filename: "special_global_vote.mp4" })]).present).toBe(true);
    expect(expectedPresence(vote!, [video({ folder: "calls", filename: "izsaukums_global_vote.mp4" })]).present).toBe(true);
    expect(expectedPresence(vote!, [video({ folder: "calls", filename: "izsaukums_global_vote.mp4" })]).filename).toBe("izsaukums_global_vote.mp4");
    expect(expectedPresence(vote!, [video({ folder: "calls", filename: "izsaukums_look.mp4" })]).present).toBe(false);
    const talent = expectedLibrary().find((file) => file.cardId === "global_talent");
    expect(expectedPresence(talent!, [video({ folder: "calls", filename: "izsaukums_global_talent.mp4" })]).present).toBe(true);
    const rematch = expectedLibrary().find((file) => file.cardId === "global_rematch");
    expect(expectedPresence(rematch!, [video({ folder: "calls", filename: "izsaukums_global_rematch.mp4" })]).present).toBe(true);
  });

  it("ar pašreizējiem 50 video sagaidāmajos failos nav trūkstošu", () => {
    const current = [
      ...Array.from({ length: 20 }, (_, i) => video({ folder: "standby", filename: `${i + 1}.mp4` })),
      ...[
        "izsaukums_absurd_duet", "izsaukums_any", "izsaukums_bad_ad", "izsaukums_bad_lawyer",
        "izsaukums_committee", "izsaukums_dubious_team", "izsaukums_flash", "izsaukums_freeze_frame",
        "izsaukums_gesture", "izsaukums_global_rematch", "izsaukums_global_talent", "izsaukums_improv_story",
        "izsaukums_look", "izsaukums_mimic", "izsaukums_mission", "izsaukums_pair", "izsaukums_perk",
        "izsaukums_reverse_story", "izsaukums_sales_pitch", "izsaukums_sports_cast", "izsaukums_team",
        "izsaukums_three_in_five", "izsaukums_truth_lie", "izsaukums_wrong_answers",
      ].map((name) => video({ folder: "calls", filename: `${name}.mp4` })),
      ...[
        "special_open", "special_end", "special_global_vote", "special_global_duel",
        "special_global_truths", "special_global_team",
      ].map((name) => video({ folder: "special", filename: `${name}.mp4` })),
    ];
    expect(current).toHaveLength(50);
    const missing = expectedLibrary().filter((file) => !expectedPresence(file, current).present);
    expect(missing).toEqual([]);
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
