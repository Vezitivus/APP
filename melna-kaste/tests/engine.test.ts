import { describe, expect, it } from "vitest";
import { apply } from "../src/lib/game/engine";
import { missionView, toAdminState, toPlayerState, toTvState } from "../src/lib/game/project";
import { TEST_CYCLE_MS, TEST_PLAYER_NAMES } from "../src/lib/game/types";
import { act, addPair, ctx, game, standby, video } from "./helpers";

const NOW = 1_700_000_000_000;

describe("spēles norise un taimeri", () => {
  it("nesākas ar mazāk nekā diviem dalībniekiem un neierobežo maksimumu", () => {
    let state = game(NOW);
    expect(apply(state, { type: "start" }, ctx(NOW)).error?.code).toBe("not_ready");
    expect(apply(state, { type: "add_player", name: "Viens", sessionHash: "h1", recoveryHash: "r1" }, ctx(NOW)).error?.code).toBe("not_ready");
    state = act(state, { type: "activate" }, ctx(NOW)).state;
    expect(state.joinOpen).toBe(true);
    expect(state.phase).toBe("LOBBY");
    expect(apply(state, { type: "start" }, ctx(NOW)).error?.code).toBe("need_players");
    state = act(state, { type: "add_player", name: "Viens", sessionHash: "h1", recoveryHash: "r1" }, ctx(NOW)).state;
    expect(apply(state, { type: "start" }, ctx(NOW)).error?.code).toBe("need_players");
    for (let i = 0; i < 40; i += 1) {
      state = act(state, { type: "add_player", name: `Viesis ${i}`, sessionHash: `h-${i}`, recoveryHash: `r-${i}` }, ctx(NOW)).state;
    }
    expect(state.players).toHaveLength(41);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    expect(state.phase).toBe("STANDBY");
    expect(state.started).toBe(true);
    expect(state.joinOpen).toBe(false);
  });

  it("intervāla beigas sagatavo izsaukumu un nepārtrauc video", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(4) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW, () => 0)).state;
    const token = state.playback.clipToken;
    const index = state.playback.index;
    expect(state.nextAutoAt).toBeTruthy();
    const due = Date.parse(state.nextAutoAt!);
    const ticked = act(state, { type: "tick" }, ctx(due, () => 0));
    expect(ticked.state.phase).toBe("QUEUED");
    expect(ticked.state.playback.clipToken).toBe(token);
    expect(ticked.state.playback.index).toBe(index);
    expect(ticked.state.queue?.cardId).toBeTruthy();
    const tv = toTvState(ticked.state, due);
    expect(tv.phase).toBe("STANDBY");
    expect(tv.screen.kind).toBe("standby");
    expect(JSON.stringify(tv)).not.toContain(ticked.state.queue!.playerName!);
  });

  it("izsaukums rindas vidū gaida pilnu ciklu un tikai tad sākas video", () => {
    let state = addPair(game(NOW), NOW);
    const clips = [...standby(4), video({ folder: "calls", filename: "izsaukums_look.mp4" })];
    state = act(state, { type: "sync_videos", videos: clips }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    expect(state.phase).toBe("QUEUED");
    expect(state.playback.index).toBe(0);
    for (let step = 0; step < 3; step += 1) {
      const ended = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW));
      state = ended.state;
      expect(state.phase).toBe("QUEUED");
      expect(state.playback.mode).toBe("standby");
    }
    const beforeCall = state.playback.clipToken;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: beforeCall }, ctx(NOW)).state;
    expect(state.phase).toBe("ANNOUNCEMENT");
    expect(state.playback.mode).toBe("announcement");
    expect(state.active?.qrExpiresAt).toBeNull();
    const tv = toTvState(state, NOW);
    expect(tv.screen.kind).toBe("announcement");
    expect(JSON.stringify(tv)).not.toContain(state.players[0].publicName);
  });

  it("pēc izsaukuma video TV paliek pie QR, kamēr režija nospiež Turpināt", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: [...standby(3), video({ folder: "calls", filename: "izsaukums_look.mp4" })] }, ctx(NOW)).state;
    state = act(state, { type: "update_settings", patch: { qrSeconds: 60, minIntervalSec: 600, maxIntervalSec: 600 } }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    for (let step = 0; step < 3; step += 1) {
      state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    }
    expect(state.phase).toBe("ANNOUNCEMENT");
    expect(toTvState(state, NOW).screen.kind).toBe("announcement");
    const announcedAt = NOW + 5_000;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(announcedAt)).state;
    expect(state.phase).toBe("QR_WAITING");
    expect(state.active?.tvHold).toBe(true);
    expect(state.active?.qrExpiresAt).toBeNull();
    expect(state.playback.mode).toBe("hold");
    const held = toTvState(state, announcedAt);
    expect(held.screen).toMatchObject({
      kind: "call",
      name: state.players[0].publicName,
      title: "Nenopietnā runa",
    });
    if (held.screen.kind === "call") expect(held.screen.videoUrl).toContain("izsaukums_look.mp4");
    const later = apply(state, { type: "tick" }, ctx(announcedAt + 60 * 60 * 1000));
    expect(later.ignored).toBe(true);
    expect(later.state.phase).toBe("QR_WAITING");
    expect(later.state.active?.qrToken).toBe(state.active?.qrToken);
    const reloaded = toTvState(state, announcedAt + 60 * 60 * 1000);
    expect(reloaded.screen.kind).toBe("call");
    const hurried = apply(state, { type: "accelerate" }, ctx(announcedAt));
    expect(hurried.error?.code).toBe("not_ready");
    state = act(state, { type: "continue_tv" }, ctx(announcedAt + 90_000)).state;
    expect(state.phase).toBe("STANDBY");
    expect(state.active).toBeNull();
    expect(state.playback.mode).toBe("standby");
    expect(state.playback.index).toBe(0);
    expect(state.playback.clipId).toBe("standby_01.mp4");
    expect(toTvState(state, announcedAt + 90_000).screen.kind).toBe("standby");
  });

  it("novecojis vai atkārtots video beigu signāls neizsauc otru notikumu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(
      state,
      { type: "sync_videos", videos: [...standby(2), video({ folder: "calls", filename: "izsaukums_look.mp4" })] },
      ctx(NOW),
    ).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    const first = { cycleId: state.playback.cycleId, clipToken: state.playback.clipToken };
    state = act(state, { type: "clip_ended", ...first }, ctx(NOW)).state;
    const stale = apply(state, { type: "clip_ended", ...first }, ctx(NOW));
    expect(stale.ignored).toBe(true);
    expect(stale.state.phase).toBe("QUEUED");
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase).toBe("ANNOUNCEMENT");
    const announcement = { cycleId: state.playback.cycleId, clipToken: state.playback.clipToken };
    state = act(state, { type: "clip_ended", ...announcement }, ctx(NOW + 1000)).state;
    expect(state.phase).toBe("QR_WAITING");
    const duplicate = apply(state, { type: "clip_ended", ...announcement }, ctx(NOW + 2000));
    expect(duplicate.ignored).toBe(true);
    expect(duplicate.state.phase).toBe("QR_WAITING");
    expect(state.players[0].callCount).toBe(1);
  });

  it("izlaižot rindu, video netiek pārtraukts un TV nesaņem režijas paziņojumu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(3) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "gesture", playerId: state.players[0].id }, ctx(NOW)).state;
    const playback = { ...state.playback };
    state = act(state, { type: "skip" }, ctx(NOW)).state;
    expect(state.queue).toBeNull();
    expect(state.phase).toBe("STANDBY");
    expect(state.playback).toEqual(playback);
    const tv = JSON.stringify(toTvState(state, NOW));
    expect(tv).not.toContain("atcēl");
    expect(tv).not.toContain("organizator");
    expect(tv).not.toContain("izlaist");
  });

  it("dalībnieka nomaiņa anulē veco QR un patur kartīti", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(1) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    const oldToken = state.active!.qrToken;
    state = act(state, { type: "swap_player", playerId: state.players[1].id }, ctx(NOW)).state;
    expect(state.active?.cardId).toBe("look");
    expect(state.active?.playerId).toBe(state.players[1].id);
    expect(state.active?.qrToken).not.toBe(oldToken);
    const wrong = apply(state, { type: "claim", qrToken: oldToken, playerId: state.players[0].id }, ctx(NOW));
    expect(wrong.error?.code).toBe("not_found");
    expect(wrong.state.players[0].callCount).toBe(0);
    expect(state.players[1].callCount).toBe(1);
  });

  it("nepareizs dalībnieks nesaņem kartītes saturu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "mission_03", playerId: state.players[0].id }, ctx(NOW + 10)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW + 20)).state;
    expect(state.phase).toBe("QR_WAITING");
    const token = state.active!.qrToken;
    const wrong = apply(state, { type: "claim", qrToken: token, playerId: state.players[1].id }, ctx(NOW + 20));
    expect(wrong.error?.code).toBe("wrong_player");
    expect(JSON.stringify(wrong.error)).not.toContain("šautriņu");
    const hidden = missionView(state, token, state.players[1].id, NOW + 20);
    expect(hidden.status).toBe("forbidden");
    expect(JSON.stringify(hidden)).not.toContain("šautriņu");
    const stranger = missionView(state, token, null, NOW + 20);
    expect(stranger.status).toBe("need_session");
    expect(JSON.stringify(toTvState(state, NOW + 20))).not.toContain("šautriņu");
    expect(JSON.stringify(toAdminState(state, NOW + 20))).toContain("šautriņu");
  });

  it("pareizais dalībnieks saņem misiju, un TV paliek pie izsaukuma līdz Turpināt", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "mission_01", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW)).state;
    const token = state.active!.qrToken;
    state = act(state, { type: "claim", qrToken: token, playerId: state.players[0].id }, ctx(NOW)).state;
    expect(state.phase).toBe("QR_WAITING");
    expect(state.active?.tvHold).toBe(true);
    expect(state.missions).toHaveLength(1);
    expect(state.missions[0].text).toContain("NHL");
    expect(state.queue).toBeNull();
    const owner = missionView(state, token, state.players[0].id, NOW);
    expect(owner.status).toBe("mission");
    const tv = JSON.stringify(toTvState(state, NOW));
    const admin = JSON.stringify(toAdminState(state, NOW));
    expect(toTvState(state, NOW).screen.kind).toBe("call");
    expect(tv).not.toContain("NHL");
    expect(admin).toContain("NHL");
    expect(toAdminState(state, NOW).active?.tvHold).toBe(true);
    const player = toPlayerState(state, state.players[0], NOW);
    expect(player.missions[0].text).toContain("NHL");
    expect(toPlayerState(state, state.players[1], NOW).missions).toHaveLength(0);
    const blocked = apply(state, { type: "prepare", cardId: "look", playerId: state.players[1].id }, ctx(NOW + 50));
    expect(blocked.error?.code).toBe("not_ready");
    state = act(state, { type: "continue_tv" }, ctx(NOW + 40)).state;
    expect(state.phase).toBe("STANDBY");
    expect(state.active).toBeNull();
    expect(state.missions[0].status).toBe("active");
    expect(toTvState(state, NOW + 40).screen.kind).toBe("static");
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[1].id }, ctx(NOW + 50)).state;
    expect(state.phase).toBe("QUEUED");
    expect(state.missions[0].status).toBe("active");
  });

  it("priekšrocību nevar izmantot otrreiz", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "perk_veto", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW)).state;
    state = act(state, { type: "claim", qrToken: state.active!.qrToken, playerId: state.players[0].id }, ctx(NOW)).state;
    const perkId = state.perks[0].id;
    state = act(state, { type: "request_perk", perkId, playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "confirm_perk", perkId }, ctx(NOW)).state;
    expect(state.perks[0].status).toBe("used");
    const again = apply(state, { type: "confirm_perk", perkId }, ctx(NOW));
    expect(again.error?.code).toBe("used");
  });

  it("brīvo izvēli un brīvo dueli nevar sagatavot, jo tiem nav video", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    const choice = apply(state, { type: "prepare", cardId: "choice", playerId: state.players[0].id }, ctx(NOW));
    expect(choice.error?.code).toBe("no_card");
    const duel = apply(state, { type: "prepare", cardId: "duel", playerId: state.players[0].id }, ctx(NOW));
    expect(duel.error?.code).toBe("no_card");
    expect(toAdminState(state, NOW).catalog.some((card) => card.id === "choice" || card.id === "duel")).toBe(false);
  });

  it("paātrināšana sagatavo notikumu vai saīsina QR līdz piecām sekundēm", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(2) }, ctx(NOW)).state;
    state = act(state, { type: "update_settings", patch: { minIntervalSec: 600, maxIntervalSec: 1200 } }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW, () => 0.5)).state;
    const scheduled = Date.parse(state.nextAutoAt!);
    expect(scheduled - NOW).toBeGreaterThanOrEqual(600_000);
    state = act(state, { type: "accelerate" }, ctx(NOW + 1000, () => 0)).state;
    expect(state.phase).toBe("QUEUED");
    expect(state.playback.index).toBe(0);
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase === "ANNOUNCEMENT" || state.phase === "QR_WAITING").toBe(true);
    if (state.phase === "ANNOUNCEMENT") {
      state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW + 5000)).state;
    }
    expect(state.phase).toBe("QR_WAITING");
    expect(state.active?.tvHold).toBe(true);
    const held = apply(state, { type: "accelerate" }, ctx(NOW + 5000));
    expect(held.error?.code).toBe("not_ready");
    expect(held.state.phase).toBe("QR_WAITING");
    expect(held.state.active?.qrToken).toBe(state.active?.qrToken);
  });

  it("pauze aptur automātisko sagatavošanu, bet ne standby signālu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(2) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "pause" }, ctx(NOW)).state;
    const token = state.playback.clipToken;
    const due = NOW + 60 * 60 * 1000;
    const ticked = apply(state, { type: "tick" }, ctx(due));
    expect(ticked.ignored).toBe(true);
    expect(ticked.state.queue).toBeNull();
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: token }, ctx(due)).state;
    expect(state.playback.mode).toBe("standby");
    expect(state.playback.index).toBe(1);
  });

  it("bojāts video nepabeidz ciklu un nesāk izsaukumu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(1) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "clip_failed", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase).toBe("QUEUED");
    expect(state.playback.cycleIntact).toBe(false);
    expect(state.warnings.length).toBeGreaterThan(0);
    expect(toAdminState(state, NOW).warnings[0].message.length).toBeGreaterThan(10);
  });

  it("bez standby video testa cikls palaiž sagatavoto izsaukumu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    expect(state.playback.mode).toBe("static");
    expect(state.testCycleDeadline).toBe(new Date(NOW + TEST_CYCLE_MS).toISOString());
    state = act(state, { type: "prepare", cardId: "wrong_answers", playerId: state.players[1].id }, ctx(NOW)).state;
    const waiting = apply(state, { type: "tick" }, ctx(NOW + TEST_CYCLE_MS - 1));
    expect(waiting.ignored).toBe(true);
    state = act(state, { type: "tick" }, ctx(NOW + TEST_CYCLE_MS)).state;
    expect(state.phase === "QR_WAITING" || state.phase === "ANNOUNCEMENT").toBe(true);
  });

  it("attaisīšana, uzvarētājs un pabeigšana sasniedz visus stāvokļus", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW)).state;
    state = act(state, { type: "claim", qrToken: state.active!.qrToken, playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "decline", playerId: state.players[0].id }, ctx(NOW)).state;
    expect(state.phase).toBe("STANDBY");
    expect(JSON.stringify(toTvState(state, NOW))).not.toContain("atteic");
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW)).state;
    state = act(state, { type: "claim", qrToken: state.active!.qrToken, playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "complete_event", winnerId: state.players[1].id }, ctx(NOW)).state;
    expect(state.recentEvents[0].outcome?.winnerName).toBe(state.players[1].publicName);
    state = act(state, { type: "finish" }, ctx(NOW)).state;
    expect(state.phase).toBe("FINISHED");
    expect(toTvState(state, NOW).screen.kind).toBe("finished");
    expect(toAdminState(state, NOW).phase).toBe("FINISHED");
  });

  it("administratora stāvoklis nesatur sesiju noslēpumus", () => {
    const state = addPair(game(NOW), NOW);
    const admin = JSON.stringify(toAdminState(state, NOW));
    expect(admin).not.toContain("hash-a");
    expect(admin).not.toContain("rec-a");
    expect(admin).not.toContain("sessionHash");
  });

  it("seši testa dalībnieki saņem vienreizējus kodus", () => {
    const secrets = TEST_PLAYER_NAMES.map((_, index) => ({
      sessionHash: `s-${index}`,
      recoveryHash: `h-${index}`,
      recoveryCode: `KODS${index}`,
    }));
    let state = act(game(NOW), { type: "activate" }, ctx(NOW)).state;
    const result = act(state, { type: "add_test_players", players: secrets }, ctx(NOW));
    expect(result.issued?.testPlayers).toHaveLength(6);
    expect(result.state.players.map((player) => player.publicName)).toEqual(TEST_PLAYER_NAMES);
    expect(JSON.stringify(result.state.history)).not.toContain("KODS0");
  });

  it("kopīgais notikums gaida cikla beigas un neprasa QR", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(2) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "activate_global", cardId: "global_vote" }, ctx(NOW)).state;
    expect(state.phase).toBe("QUEUED");
    expect(toTvState(state, NOW).screen.kind).toBe("standby");
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase === "ANNOUNCEMENT" || state.phase === "ACTIVE_EVENT").toBe(true);
    if (state.phase === "ANNOUNCEMENT") {
      state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    }
    expect(state.phase).toBe("ACTIVE_EVENT");
    const tv = toTvState(state, NOW);
    expect(tv.screen.kind).toBe("event");
    if (tv.screen.kind === "event") expect(tv.screen.title).toBe("Klusā balsošana");
    expect(JSON.stringify(tv)).not.toContain("/mission/");
  });

  it("bez izsaukuma video rāda ietvaru, un skenēt var arī pēc ilga laika", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "complete_test_cycle" }, ctx(NOW)).state;
    expect(state.playback.mode).toBe("hold");
    const tv = toTvState(state, NOW);
    expect(tv.screen).toMatchObject({ kind: "call", title: "Nenopietnā runa", videoUrl: null });
    const scannedAt = NOW + 30 * 60 * 1000;
    state = act(state, { type: "claim", qrToken: state.active!.qrToken, playerId: state.players[0].id }, ctx(scannedAt)).state;
    expect(state.phase).toBe("ACTIVE_EVENT");
    expect(toTvState(state, scannedAt).screen.kind).toBe("call");
    const skipped = apply(state, { type: "skip" }, ctx(scannedAt));
    expect(skipped.error).toBeUndefined();
    expect(skipped.state.phase).toBe("STANDBY");
    expect(skipped.state.active).toBeNull();
    expect(toTvState(skipped.state, scannedAt).screen.kind).toBe("static");
  });

  it("izlaišana aizver TV izsaukumu un atgriež standby no pirmā klipa", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "sync_videos", videos: standby(3) }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.playback.index).toBe(1);
    state = act(state, { type: "prepare", cardId: "gesture", playerId: state.players[0].id }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase).toBe("QR_WAITING");
    state = act(state, { type: "skip" }, ctx(NOW)).state;
    expect(state.phase).toBe("STANDBY");
    expect(state.playback.index).toBe(0);
    expect(state.playback.clipId).toBe("standby_01.mp4");
    const tv = JSON.stringify(toTvState(state, NOW));
    expect(tv).not.toContain(state.players[0].publicName);
  });

  it("ciparu standby riņķis iet 1, 2, 10, un automātika gaida pēdējo", () => {
    let state = addPair(game(NOW), NOW);
    const clips = [10, 2, 1].map((slot) => video({ folder: "standby", filename: `${slot}.mp4` }));
    state = act(state, { type: "sync_videos", videos: clips }, ctx(NOW)).state;
    state = act(state, { type: "update_settings", patch: { minIntervalSec: 60, maxIntervalSec: 60 } }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW, () => 0)).state;
    expect(state.playback.clipId).toBe("1.mp4");
    const playing = { cycleId: state.playback.cycleId, clipToken: state.playback.clipToken };
    const due = Date.parse(state.nextAutoAt!);
    state = act(state, { type: "tick" }, ctx(due, () => 0)).state;
    expect(state.phase).toBe("QUEUED");
    expect(state.playback).toMatchObject({ mode: "standby", clipId: "1.mp4", clipToken: playing.clipToken });
    const admin = toAdminState(state, due);
    expect(admin.waitingForLoop).toBe(true);
    expect(admin.standbySlots).toHaveLength(20);
    expect(admin.standbySlots.filter((slot) => slot.present).map((slot) => slot.slot)).toEqual([1, 2, 10]);
    expect(admin.standbySlots[0].current).toBe(true);
    expect(admin.standbySlots[2].present).toBe(false);
    expect(toTvState(state, due).screen.kind).toBe("standby");
    const duplicate = apply(state, { type: "clip_ended", ...playing }, ctx(due));
    state = duplicate.state;
    expect(state.phase).toBe("QUEUED");
    expect(state.playback.clipId).toBe("2.mp4");
    const again = apply(state, { type: "clip_ended", ...playing }, ctx(due));
    expect(again.ignored).toBe(true);
    expect(again.state.playback.clipId).toBe("2.mp4");
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(due)).state;
    expect(state.phase).toBe("QUEUED");
    expect(state.playback.clipId).toBe("10.mp4");
    const reloaded = state.playback.clipToken;
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: reloaded }, ctx(due)).state;
    expect(state.phase === "ANNOUNCEMENT" || state.phase === "QR_WAITING").toBe(true);
    expect(state.playback.mode).not.toBe("standby");
  });

  it("Izsaukt sāk uzreiz, un pārtrauktais klips vairs nevar atvērt otru izsaukumu", () => {
    let state = addPair(game(NOW), NOW);
    state = act(
      state,
      {
        type: "sync_videos",
        videos: [1, 2, 3].map((slot) => video({ folder: "standby", filename: `${slot}.mp4` })).concat([
          video({ folder: "calls", filename: "izsaukums_look.mp4" }),
        ]),
      },
      ctx(NOW),
    ).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW)).state;
    const pending = { cycleId: state.playback.cycleId, clipToken: state.playback.clipToken };
    state = act(state, { type: "call_now" }, ctx(NOW)).state;
    expect(state.phase).toBe("ANNOUNCEMENT");
    expect(state.playback.mode).toBe("announcement");
    expect(state.queue).toBeNull();
    expect(toAdminState(state, NOW).waitingForLoop).toBe(false);
    const stale = apply(state, { type: "clip_ended", ...pending }, ctx(NOW + 10));
    expect(stale.ignored).toBe(true);
    expect(stale.state.phase).toBe("ANNOUNCEMENT");
    expect(stale.state.playback.mode).toBe("announcement");
  });

  it("bez video testa cikls vēl gaida, bet Izsaukt nesagaida", () => {
    let state = addPair(game(NOW), NOW);
    state = act(state, { type: "start" }, ctx(NOW)).state;
    state = act(state, { type: "prepare", cardId: "look", playerId: state.players[0].id }, ctx(NOW + 1000)).state;
    expect(toAdminState(state, NOW + 1000).waitingForLoop).toBe(true);
    const early = apply(state, { type: "tick" }, ctx(NOW + TEST_CYCLE_MS - 1));
    expect(early.ignored).toBe(true);
    expect(early.state.phase).toBe("QUEUED");
    state = act(state, { type: "call_now" }, ctx(NOW + 1500)).state;
    expect(state.phase).toBe("QR_WAITING");
    expect(state.playback.mode).toBe("hold");
  });

  it("bibliotēkas atjaunošana nepārstartē pašreizējo klipu", () => {
    let state = addPair(game(NOW), NOW);
    const clips = [1, 2].map((slot) => video({ folder: "standby", filename: `${slot}.mp4` }));
    state = act(state, { type: "sync_videos", videos: clips }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    const token = state.playback.clipToken;
    state = act(state, { type: "sync_videos", videos: clips }, ctx(NOW + 5)).state;
    expect(state.playback.clipToken).toBe(token);
    expect(state.playback.clipId).toBe("1.mp4");
    expect(state.playback.index).toBe(0);
  });
  it("aktivizācija palaiž standby un QR, sākums rāda special_open", () => {
    let state = game(NOW);
    state = act(state, { type: "sync_videos", videos: [...standby(3), video({ folder: "special", filename: "special_open.mp4" })] }, ctx(NOW)).state;
    state = act(state, { type: "activate" }, ctx(NOW)).state;
    expect(state.phase).toBe("LOBBY");
    expect(state.joinOpen).toBe(true);
    expect(state.started).toBe(false);
    expect(state.playback.mode).toBe("standby");
    expect(state.nextAutoAt).toBeNull();
    const tv = toTvState(state, NOW);
    expect(tv.screen.kind).toBe("standby");
    expect(tv.joinOpen).toBe(true);
    expect(tv.playback.clipUrl).toBeTruthy();
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase).toBe("LOBBY");
    expect(state.joinOpen).toBe(true);
    expect(state.nextAutoAt).toBeNull();
    state = act(state, { type: "add_player", name: "Anna", sessionHash: "hash-a", recoveryHash: "rec-a" }, ctx(NOW)).state;
    state = act(state, { type: "add_player", name: "Bruno", sessionHash: "hash-b", recoveryHash: "rec-b" }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    expect(state.started).toBe(true);
    expect(state.joinOpen).toBe(false);
    expect(state.playback.mode).toBe("intro");
    expect(toTvState(state, NOW).joinOpen).toBe(false);
    expect(toTvState(state, NOW).screen.kind).toBe("intro");
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.phase).toBe("STANDBY");
    expect(state.nextAutoAt).toBeTruthy();
  });

  it("spēles laikā jaunus dalībniekus pieņem tikai ar atvērtu pievienošanos un Atsākt pārkārto uzdevumus", () => {
    let state = addPair(game(NOW), NOW);
    const clips = [
      ...standby(2),
      video({ folder: "special", filename: "special_open.mp4" }),
      video({ folder: "calls", filename: "izsaukums_dubious_team.mp4" }),
    ];
    state = act(state, { type: "sync_videos", videos: clips }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    if (state.playback.mode === "intro") {
      state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    }
    state = act(state, { type: "prepare", cardId: "dubious_team", playerId: state.players[0].id }, ctx(NOW)).state;
    expect(state.queue?.extraPlayers).toHaveLength(1);
    expect(state.usedCards.TEAM).toContain("dubious_team");
    const historyLen = state.history.length;
    const callCount = state.players[0].callCount;
    expect(apply(state, { type: "add_player", name: "Kārlis", sessionHash: "hash-c", recoveryHash: "rec-c" }, ctx(NOW)).error?.code).toBe("not_ready");
    state = act(state, { type: "open_join" }, ctx(NOW)).state;
    expect(state.joinOpen).toBe(true);
    expect(toTvState(state, NOW).joinOpen).toBe(true);
    expect(state.phase).toBe("QUEUED");
    state = act(state, { type: "add_player", name: "Kārlis", sessionHash: "hash-c", recoveryHash: "rec-c" }, ctx(NOW)).state;
    expect(state.players.map((player) => player.publicName)).toEqual(["Anna", "Anna 2", "Kārlis"]);
    state = act(state, { type: "resume_play" }, ctx(NOW)).state;
    expect(state.joinOpen).toBe(false);
    expect(state.playback.mode).toBe("intro");
    expect(state.phase).toBe("QUEUED");
    expect(state.queue?.extraPlayers).toHaveLength(2);
    expect(state.queue?.extraPlayers.map((player) => player.name)).toContain("Kārlis");
    expect(state.usedCards).toEqual({});
    expect(state.players[0].callCount).toBe(callCount);
    expect(state.history.length).toBeGreaterThanOrEqual(historyLen);
    expect(state.players).toHaveLength(3);
  });

  it("intro iepriekšielādē pirmo standby, un 20. klips rinķojot ved uz 1.", () => {
    let state = addPair(game(NOW), NOW);
    const clips = [
      ...Array.from({ length: 20 }, (_, i) => video({ folder: "standby", filename: `${i + 1}.mp4` })),
      video({ folder: "special", filename: "special_open.mp4" }),
      video({ folder: "special", filename: "special_end.mp4" }),
    ];
    state = act(state, { type: "sync_videos", videos: clips }, ctx(NOW)).state;
    state = act(state, { type: "start" }, ctx(NOW)).state;
    expect(state.playback.mode).toBe("intro");
    const duringIntro = toTvState(state, NOW);
    expect(duringIntro.playback.nextUrl).toContain("1.mp4");
    state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    expect(state.playback.mode).toBe("standby");
    expect(state.playback.index).toBe(0);
    for (let step = 0; step < 19; step += 1) {
      state = act(state, { type: "clip_ended", cycleId: state.playback.cycleId, clipToken: state.playback.clipToken }, ctx(NOW)).state;
    }
    expect(state.playback.index).toBe(19);
    const last = toTvState(state, NOW);
    expect(last.playback.clipUrl).toContain("20.mp4");
    expect(last.playback.nextUrl).toContain("1.mp4");
    state = act(state, { type: "finish" }, ctx(NOW)).state;
    expect(state.playback.mode).toBe("outro");
    expect(toTvState(state, NOW).playback.announcementUrl).toContain("special_end.mp4");
  });

});
