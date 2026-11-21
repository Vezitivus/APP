import { cardById, catalog, isBuiltinCard, isPlayable } from "./cards";
import { eligiblePlayers, pickCardFromCategory, pickCategory, pickExtras, pickPlayer, uniquePublicName } from "./selection";
import {
  DEFAULT_SETTINGS,
  TEST_CYCLE_MS,
  TEST_PLAYER_NAMES,
  type Action,
  type ApplyResult,
  type AutoCategory,
  type CardDef,
  type Ctx,
  type GameState,
  type HistoryEntry,
  type LiveEvent,
  type Phase,
  type Playback,
  type Player,
  type Settings,
} from "./types";
import { resolveCallVideo, specialEnd, specialOpen, standbyPlaylist } from "./videos";

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function iso(now: number): string {
  return new Date(now).toISOString();
}

function playback(ctx: Ctx, mode: Playback["mode"]): Playback {
  return {
    cycleId: ctx.id(),
    index: 0,
    clipId: null,
    clipToken: ctx.id(),
    mode,
    announcementUrl: null,
    cycleIntact: true,
    failureRounds: 0,
    clipFailures: 0,
    cycleStartedAt: mode === "standby" || mode === "static" ? iso(ctx.now) : null,
  };
}

export function createGame(input: { id: string; code: string; now: number }): GameState {
  const ctx: Ctx = { now: input.now, rng: Math.random, id: () => input.id };
  return {
    id: input.id,
    code: input.code,
    phase: "LOBBY",
    paused: false,
    autoCalls: true,
    version: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    players: [],
    playback: playback(ctx, "idle"),
    queue: null,
    active: null,
    missions: [],
    perks: [],
    videos: [],
    customCards: [],
    usedCards: {},
    warnings: [],
    audioBlocked: false,
    nextAutoAt: null,
    testCycleDeadline: null,
    history: [],
    recentEvents: [],
    createdAt: iso(input.now),
    updatedAt: iso(input.now),
    started: false,
    joinOpen: false,
  };
}

/** Fill flags missing from older saved snapshots. */
export function normalizeGame(state: GameState): GameState {
  if (typeof state.started !== "boolean") state.started = state.phase !== "LOBBY";
  if (typeof state.joinOpen !== "boolean") state.joinOpen = false;
  for (const player of state.players ?? []) {
    const raw = player as Player & { recoveryHash?: string };
    if (!raw.pinHash && raw.recoveryHash) raw.pinHash = raw.recoveryHash;
    delete raw.recoveryHash;
    if (!raw.pinHash) raw.pinHash = "";
    if (typeof raw.pinFailedAttempts !== "number" || raw.pinFailedAttempts < 0) raw.pinFailedAttempts = 0;
    if (raw.pinLockedUntil === undefined) raw.pinLockedUntil = null;
  }
  return state;
}

export function apply(state: GameState, action: Action, ctx: Ctx): ApplyResult {
  const next = normalizeGame(structuredClone(state));
  const appended: HistoryEntry[] = [];
  const issued: NonNullable<ApplyResult["issued"]> = {};
  const note = (type: string, summary: string) => {
    appended.push({ id: ctx.id(), at: iso(ctx.now), type, summary });
  };
  try {
    const outcome = handle(next, action, ctx, note, issued);
    if (outcome === "ignore") return { state, appended: [], ignored: true };
  } catch (error) {
    if (error instanceof GameError) return { state, appended: [], error: { code: error.code, message: error.message } };
    throw error;
  }
  next.version = state.version + 1;
  next.updatedAt = iso(ctx.now);
  next.history = [...appended, ...next.history].slice(0, 60);
  return { state: next, appended, issued };
}

function handle(
  state: GameState,
  action: Action,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
  issued: NonNullable<ApplyResult["issued"]>,
): "ok" | "ignore" {
  switch (action.type) {
    case "add_player":
      addPlayer(state, action.name, action.sessionHash, action.pinHash, ctx, note);
      return "ok";
    case "rename_player":
      renamePlayer(state, action.playerId, action.name, note);
      return "ok";
    case "remove_player":
      removePlayer(state, action.playerId, ctx, note);
      return "ok";
    case "set_eligible":
      setEligible(state, action.playerId, action.eligible, note);
      return "ok";
    case "add_test_players":
      addTestPlayers(state, action.players, ctx, note, issued);
      return "ok";
    case "reset_pin": {
      const player = requirePlayer(state, action.playerId);
      setPlayerPin(player, action.pinHash);
      issued.playerId = player.id;
      note("pin", `PIN nomainīts: ${player.publicName}`);
      return "ok";
    }
    case "pin_failed": {
      const player = requirePlayer(state, action.playerId);
      recordPinFailure(player, ctx);
      return "ok";
    }
    case "rotate_session": {
      const player = requirePlayer(state, action.playerId);
      player.sessionHash = action.sessionHash;
      clearPinLock(player);
      note("session", `Sesija atjaunota: ${player.publicName}`);
      return "ok";
    }
    case "update_settings":
      state.settings = normalizeSettings({ ...state.settings, ...action.patch });
      note("settings", "Iestatījumi atjaunoti");
      return "ok";
    case "activate":
      activate(state, ctx, note);
      return "ok";
    case "start":
      start(state, ctx, note);
      return "ok";
    case "open_join":
      openJoin(state, note);
      return "ok";
    case "resume_play":
      resumePlay(state, ctx, note);
      return "ok";
    case "pause":
      if (state.phase === "LOBBY" || state.phase === "FINISHED") throw new GameError("not_ready", "Šajā brīdī pauzi nevar ieslēgt.");
      state.paused = true;
      state.nextAutoAt = null;
      note("pause", "Automātiskā sagatavošana apturēta");
      return "ok";
    case "resume":
      if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
      state.paused = false;
      scheduleAuto(state, ctx);
      note("resume", "Spēle turpinās");
      return "ok";
    case "finish":
      finish(state, ctx, note);
      return "ok";
    case "reset":
      reset(state, ctx, note);
      return "ok";
    case "set_auto":
      state.autoCalls = action.enabled;
      if (!action.enabled) state.nextAutoAt = null;
      else scheduleAuto(state, ctx);
      note("auto", action.enabled ? "Automātiskie izsaukumi ieslēgti" : "Automātiskie izsaukumi izslēgti");
      return "ok";
    case "prepare":
      prepare(state, ctx, note, action.playerId, action.cardId);
      return "ok";
    case "accelerate":
      return accelerate(state, ctx, note);
    case "call_now":
      callNow(state, ctx, note, action.playerId, action.cardId);
      return "ok";
    case "skip":
      skip(state, ctx, note);
      return "ok";
    case "continue_tv":
      continueTv(state, ctx, note);
      return "ok";
    case "swap_player":
      swapPlayer(state, action.playerId, ctx, note);
      return "ok";
    case "clip_ended":
      return clipEnded(state, action.cycleId, action.clipToken, ctx, note);
    case "clip_failed":
      return clipFailed(state, action.cycleId, action.clipToken, ctx, note);
    case "cycle_ended":
      return cycleEnded(state, action.cycleId, ctx, note, action.intact);
    case "tick":
      return tick(state, ctx, note);
    case "complete_test_cycle":
      return completeTestCycle(state, ctx, note);
    case "claim":
      return claim(state, action.qrToken, action.playerId, ctx, note);
    case "decline":
      decline(state, action.playerId, ctx, note);
      return "ok";
    case "submit_selection":
      submitSelection(state, action, ctx, note);
      return "ok";
    case "complete_mission":
      completeMission(state, action.missionId, action.playerId, ctx, note);
      return "ok";
    case "confirm_mission":
      reviewMission(state, action.missionId, "confirmed", note);
      return "ok";
    case "fail_mission":
      reviewMission(state, action.missionId, "failed", note);
      return "ok";
    case "request_perk":
      requestPerk(state, action.perkId, action.playerId, note);
      return "ok";
    case "confirm_perk":
      confirmPerk(state, action.perkId, ctx, note);
      return "ok";
    case "complete_event":
      closeEvent(state, "completed", ctx, note, action.winnerId);
      return "ok";
    case "fail_event":
      closeEvent(state, "failed", ctx, note);
      return "ok";
    case "activate_global":
      activateGlobal(state, action.cardId, ctx, note);
      return "ok";
    case "sync_videos":
      state.videos = action.videos;
      realignPlayback(state, ctx);
      note("videos", `Video bibliotēka atjaunota (${action.videos.length})`);
      return "ok";
    case "audio_blocked":
      if (state.audioBlocked === action.blocked) return "ignore";
      state.audioBlocked = action.blocked;
      if (action.blocked) warn(state, ctx, "TV pārlūks bloķē skaņu. Organizatoram jāaktivizē skaņa TV ekrānā.");
      return "ok";
    case "upsert_card":
      upsertCard(state, action.card, note);
      return "ok";
    case "delete_card":
      deleteCard(state, action.cardId, note);
      return "ok";
    default:
      throw new GameError("invalid", "Nezināma darbība.");
  }
}

function cardsOf(state: GameState): CardDef[] {
  return catalog(state.customCards);
}

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId && !item.removed);
  if (!player) throw new GameError("no_player", "Dalībnieks nav atrasts.");
  return player;
}

function addPlayer(
  state: GameState,
  name: string,
  sessionHash: string,
  pinHash: string,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
) {
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (!state.joinOpen) throw new GameError("not_ready", "Pievienošanās tagad nav atvērta.");
  const clean = sanitizeName(name);
  if (!clean) throw new GameError("invalid", "Vārdam jābūt no 1 līdz 24 simboliem.");
  const player: Player = {
    id: ctx.id(),
    name: clean,
    publicName: uniquePublicName(clean, state.players),
    sessionHash,
    pinHash,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    callCount: 0,
    eligible: true,
    removed: false,
    lastSeenAt: iso(ctx.now),
    createdAt: iso(ctx.now),
  };
  state.players.push(player);
  note("join", `Pievienojās ${player.publicName}`);
}

export function findPlayersByName(state: GameState, name: string): Player[] {
  const clean = sanitizeName(name);
  if (!clean) return [];
  const wanted = clean.toLocaleLowerCase("lv");
  return state.players.filter(
    (item) =>
      !item.removed &&
      (item.publicName.toLocaleLowerCase("lv") === wanted || item.name.toLocaleLowerCase("lv") === wanted),
  );
}

export function isPinLocked(player: Player, now: number): boolean {
  return Boolean(player.pinLockedUntil && Date.parse(player.pinLockedUntil) > now);
}

function setPlayerPin(player: Player, pinHash: string) {
  player.pinHash = pinHash;
  clearPinLock(player);
}

function clearPinLock(player: Player) {
  player.pinFailedAttempts = 0;
  player.pinLockedUntil = null;
}

function recordPinFailure(player: Player, ctx: Ctx) {
  player.pinFailedAttempts += 1;
  if (player.pinFailedAttempts >= 5) {
    player.pinLockedUntil = iso(ctx.now + 15 * 60 * 1000);
  }
}

function renamePlayer(state: GameState, playerId: string, name: string, note: (type: string, summary: string) => void) {
  const player = requirePlayer(state, playerId);
  const clean = sanitizeName(name);
  if (!clean) throw new GameError("invalid", "Vārdam jābūt no 1 līdz 24 simboliem.");
  const others = state.players.filter((item) => item.id !== player.id);
  player.name = clean;
  player.publicName = uniquePublicName(clean, others);
  note("rename", `Vārds nomainīts uz ${player.publicName}`);
}

function removePlayer(state: GameState, playerId: string, ctx: Ctx, note: (type: string, summary: string) => void) {
  const player = requirePlayer(state, playerId);
  player.removed = true;
  player.eligible = false;
  if (state.queue?.playerId === player.id) {
    state.queue.outcome = { result: "skipped" };
    state.queue.status = "done";
    remember(state, state.queue);
    state.queue = null;
    if (state.phase === "QUEUED") state.phase = "STANDBY";
  }
  if (
    state.active?.playerId === player.id &&
    (state.phase === "QR_WAITING" || state.phase === "ANNOUNCEMENT" || state.phase === "CARD_CLAIMED" || state.phase === "ACTIVE_EVENT")
  ) {
    state.active.outcome = { result: "skipped" };
    state.active.status = "done";
    remember(state, state.active);
    state.active = null;
    beginStandby(state, ctx, true);
  } else if (!state.queue && state.phase === "STANDBY") {
    scheduleAuto(state, ctx);
  }
  note("remove", `${player.publicName} izņemts no spēles`);
}

function setEligible(state: GameState, playerId: string, eligible: boolean, note: (type: string, summary: string) => void) {
  const player = requirePlayer(state, playerId);
  player.eligible = eligible;
  note("eligible", eligible ? `${player.publicName} atkal var tikt izsaukts` : `${player.publicName} vairs netiek izsaukts`);
}

function addTestPlayers(
  state: GameState,
  secrets: { sessionHash: string; pinHash: string }[],
  ctx: Ctx,
  note: (type: string, summary: string) => void,
  issued: NonNullable<ApplyResult["issued"]>,
) {
  if (secrets.length < TEST_PLAYER_NAMES.length) throw new GameError("invalid", "Testa dalībnieku dati ir nepilnīgi.");
  issued.testPlayers = [];
  TEST_PLAYER_NAMES.forEach((name, index) => {
    const before = state.players.length;
    addPlayer(state, name, secrets[index].sessionHash, secrets[index].pinHash, ctx, note);
    const player = state.players[before];
    issued.testPlayers?.push({ id: player.id, name: player.publicName });
  });
}

function activate(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (state.started) throw new GameError("not_ready", "Spēle jau ir sākta.");
  if (state.phase !== "LOBBY") throw new GameError("not_ready", "Spēli var aktivizēt tikai no uzgaidāmās telpas.");
  state.joinOpen = true;
  state.paused = false;
  if (state.playback.mode !== "standby" && state.playback.mode !== "static") {
    beginStandby(state, ctx, false);
  }
  note("activate", "Spēle aktivizēta. Var pievienoties.");
}

function start(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (state.started) throw new GameError("not_ready", "Spēle jau ir sākta.");
  if (state.phase !== "LOBBY") throw new GameError("not_ready", "Spēli var sākt tikai no uzgaidāmās telpas.");
  if (!state.joinOpen) throw new GameError("not_ready", "Vispirms jāaktivizē spēle.");
  const count = state.players.filter((player) => !player.removed).length;
  if (count < 2) throw new GameError("need_players", "Vajag vismaz divus dalībniekus.");
  state.paused = false;
  state.started = true;
  state.joinOpen = false;
  playSpecialOpen(state, ctx, false);
  scheduleAuto(state, ctx);
  note("start", "Spēle sākta");
}

function openJoin(state: GameState, note: (type: string, summary: string) => void) {
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (!state.started) throw new GameError("not_ready", "Vispirms jāsāk spēle.");
  state.joinOpen = true;
  note("open_join", "Pievienošanās atvērta");
}

function canPlaySpecialOpen(state: GameState): boolean {
  if (state.playback.mode === "intro" || state.playback.mode === "announcement") return false;
  if (tvCallHeld(state)) return false;
  return state.phase === "STANDBY" || state.phase === "QUEUED" || state.phase === "LOBBY";
}

function playSpecialOpen(state: GameState, ctx: Ctx, schedule: boolean) {
  const intro = specialOpen(state.videos);
  if (intro) {
    if (state.started) state.phase = state.queue ? "QUEUED" : "STANDBY";
    state.playback = {
      ...playback(ctx, "intro"),
      clipId: intro.id,
      announcementUrl: intro.url,
    };
    state.testCycleDeadline = null;
  } else {
    beginStandby(state, ctx, schedule);
  }
}

function reshuffleAssignments(state: GameState, ctx: Ctx) {
  state.usedCards = {};
  const event = state.queue;
  if (!event?.playerId) return;
  const card = cardById(event.cardId, state.customCards);
  if (!card || (card.selection !== "system_one" && card.selection !== "system_many")) return;
  const idealExtras = card.selection === "system_one" ? 1 : Math.max(1, card.idealGroup - 1);
  event.extraPlayers = pickExtras(state.players, event.playerId, idealExtras, ctx.rng).map((item) => ({
    id: item.id,
    name: item.publicName,
  }));
}

function resumePlay(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (!state.started) throw new GameError("not_ready", "Vispirms jāsāk spēle.");
  state.joinOpen = false;
  reshuffleAssignments(state, ctx);
  if (canPlaySpecialOpen(state)) playSpecialOpen(state, ctx, true);
  else if (!state.nextAutoAt && !state.queue) scheduleAuto(state, ctx);
  note("resume_play", "Pievienošanās slēgta. Uzdevumi pārkārtoti.");
}

function finish(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (state.active) {
    state.active.outcome = { result: "skipped" };
    state.active.status = "done";
    remember(state, state.active);
  }
  state.phase = "FINISHED";
  state.joinOpen = false;
  state.queue = null;
  state.active = null;
  state.paused = true;
  state.nextAutoAt = null;
  state.testCycleDeadline = null;
  const ending = specialEnd(state.videos);
  if (ending) {
    state.playback = {
      ...playback(ctx, "outro"),
      clipId: ending.id,
      announcementUrl: ending.url,
    };
  } else {
    state.playback.mode = "idle";
    state.playback.announcementUrl = null;
  }
  note("finish", "Spēle pabeigta");
}

function reset(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  state.phase = "LOBBY";
  state.paused = false;
  state.autoCalls = true;
  state.started = false;
  state.joinOpen = false;
  state.players = [];
  state.playback = playback(ctx, "idle");
  state.queue = null;
  state.active = null;
  state.missions = [];
  state.perks = [];
  state.usedCards = {};
  state.warnings = [];
  state.audioBlocked = false;
  state.nextAutoAt = null;
  state.testCycleDeadline = null;
  state.history = [];
  state.recentEvents = [];
  note("reset", "Spēle atiestatīta");
}

function prepare(
  state: GameState,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
  playerId?: string | null,
  cardId?: string | null,
) {
  assertCanQueue(state);
  const cards = cardsOf(state);
  const pool = eligiblePlayers(state.players);
  if (pool.length === 0) throw new GameError("no_player", "Nav dalībnieku, kurus var izsaukt.");
  let card: CardDef | undefined;
  if (cardId) {
    card = cardById(cardId, state.customCards);
    if (!card || card.category === "GLOBAL") throw new GameError("no_card", "Šādu kartīti nevar sagatavot.");
    if (!isPlayable(card, pool.length)) throw new GameError("no_card", "Šai kartītei nepietiek dalībnieku.");
    const used = state.usedCards[card.category] ?? [];
    state.usedCards[card.category] = used.includes(card.id) ? used : [...used, card.id];
  } else {
    const picked = pickAutomaticCard(state, cards, pool.length, ctx);
    if (!picked) throw new GameError("no_card", "Nav kartītes, ko var izpildīt ar pašreizējiem dalībniekiem.");
    card = picked;
  }
  const player = playerId ? requirePlayer(state, playerId) : pickPlayer(state.players, ctx.rng);
  if (!player || player.removed || !player.eligible) throw new GameError("no_player", "Dalībnieku nevar izsaukt.");
  if (!isPlayable(card, pool.length)) throw new GameError("no_card", "Kartīte nav izpildāma.");
  state.queue = buildEvent(state, card, player.id, ctx);
  state.phase = "QUEUED";
  state.nextAutoAt = null;
  note("queue", `Sagatavots: ${player.publicName} — ${card.title}`);
}

function activateGlobal(state: GameState, cardId: string, ctx: Ctx, note: (type: string, summary: string) => void) {
  assertCanQueue(state);
  const card = cardById(cardId, state.customCards);
  if (!card || card.category !== "GLOBAL") throw new GameError("no_card", "Šis nav kopīgais notikums.");
  const event = buildEvent(state, card, null, ctx);
  event.isGlobal = true;
  event.playerId = null;
  event.playerName = null;
  state.queue = event;
  state.phase = "QUEUED";
  state.nextAutoAt = null;
  note("queue", `Sagatavots kopīgais notikums: ${card.title}`);
}

function assertCanQueue(state: GameState) {
  if (state.phase === "LOBBY") throw new GameError("not_ready", "Vispirms jāsāk spēle.");
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (state.queue) throw new GameError("already_queued", "Nākamais izsaukums jau ir rindā.");
  if (state.phase !== "STANDBY" && state.phase !== "QUEUED") {
    throw new GameError("not_ready", "Vispirms jāpabeidz aktīvais notikums.");
  }
  if (state.playback.mode === "intro") throw new GameError("not_ready", "Vispirms jāpabeidz sākuma video.");
}

function buildEvent(state: GameState, card: CardDef, playerId: string | null, ctx: Ctx): LiveEvent {
  const player = playerId ? state.players.find((item) => item.id === playerId) ?? null : null;
  const resolved = resolveCallVideo(card, state.videos);
  let extras: { id: string; name: string }[] = [];
  if (player && (card.selection === "system_one" || card.selection === "system_many")) {
    const idealExtras = card.selection === "system_one" ? 1 : Math.max(1, card.idealGroup - 1);
    extras = pickExtras(state.players, player.id, idealExtras, ctx.rng).map((item) => ({
      id: item.id,
      name: item.publicName,
    }));
  }
  return {
    eventId: ctx.id(),
    qrToken: ctx.id(),
    qrExpiresAt: null,
    playerId: player?.id ?? null,
    playerName: player?.publicName ?? null,
    extraPlayers: extras,
    cardId: card.id,
    category: card.category,
    callVideoLevel: resolved.level,
    callVideoUrl: resolved.video?.url ?? null,
    status: "queued",
    claimed: false,
    selection: card.selection,
    publicTitle: null,
    publicLines: [],
    choice: null,
    outcome: null,
    isGlobal: card.category === "GLOBAL",
    tvHold: false,
    armedCycleId: state.playback.cycleId,
  };
}

function pickAutomaticCard(state: GameState, cards: CardDef[], eligibleCount: number, ctx: Ctx): CardDef | null {
  const category = pickCategory(state.settings.categoryWeights, state.settings.activeCategories, cards, eligibleCount, ctx.rng);
  if (!category) return null;
  const used = state.usedCards[category] ?? [];
  const picked = pickCardFromCategory(cards, category, eligibleCount, used, ctx.rng);
  if (!picked) return null;
  state.usedCards[category] = picked.used;
  return picked.card;
}

function callNow(
  state: GameState,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
  playerId?: string | null,
  cardId?: string | null,
) {
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (state.phase === "LOBBY") throw new GameError("not_ready", "Vispirms jāsāk spēle.");
  if (state.playback.mode === "intro") throw new GameError("not_ready", "Vispirms jāpabeidz sākuma video.");
  if (
    tvCallHeld(state) ||
    state.playback.mode === "announcement" ||
    state.phase === "ANNOUNCEMENT" ||
    state.phase === "QR_WAITING" ||
    state.phase === "CARD_CLAIMED" ||
    state.phase === "ACTIVE_EVENT"
  ) {
    throw new GameError("not_ready", "Vispirms jāpabeidz aktīvais notikums.");
  }
  if (state.queue) {
    const otherPlayer = Boolean(playerId && playerId !== state.queue.playerId);
    const otherCard = Boolean(cardId && cardId !== state.queue.cardId);
    if (otherPlayer || otherCard) {
      throw new GameError("already_queued", "Izsaukums jau gaida riņķa beigas. Izsaukt bez jaunas izvēles to sāk uzreiz.");
    }
  } else {
    prepare(state, ctx, note, playerId ?? null, cardId ?? null);
  }
  note("call_now", "Izsaukums sākts uzreiz, negaidot standby riņķi");
  beginAnnouncement(state, ctx, note);
}

function accelerate(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void): "ok" | "ignore" {
  if (state.phase === "FINISHED") throw new GameError("finished", "Spēle ir pabeigta.");
  if (tvCallHeld(state)) throw new GameError("not_ready", "TV izsaukums paliek, kamēr nospiests Turpināt.");
  if ((state.phase === "STANDBY" || state.phase === "QUEUED") && !state.queue) {
    prepare(state, ctx, note, null, null);
    note("accelerate", "Nākamais izsaukums sagatavots, negaidot intervālu");
    return "ok";
  }
  if (state.queue && (state.phase === "QUEUED" || state.phase === "STANDBY")) {
    throw new GameError("already_queued", "Izsaukums jau gaida pilna standby cikla beigas.");
  }
  throw new GameError("not_ready", "Šajā brīdī paātrināt nevar.");
}

function skip(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (state.queue && (state.phase === "QUEUED" || state.phase === "STANDBY")) {
    state.queue.outcome = { result: "skipped" };
    state.queue.status = "done";
    remember(state, state.queue);
    state.queue = null;
    state.phase = "STANDBY";
    scheduleAuto(state, ctx);
    note("skip", "Sagatavotais izsaukums izņemts no rindas");
    return;
  }
  if (state.active && ["ANNOUNCEMENT", "QR_WAITING", "CARD_CLAIMED", "ACTIVE_EVENT"].includes(state.phase)) {
    state.active.outcome = { result: "skipped" };
    state.active.status = "done";
    state.active.qrToken = ctx.id();
    remember(state, state.active);
    state.active = null;
    beginStandby(state, ctx, true);
    note("skip", "Aktīvais notikums izlaists");
    return;
  }
  throw new GameError("not_ready", "Nav ko izlaist.");
}

function swapPlayer(state: GameState, playerId: string, ctx: Ctx, note: (type: string, summary: string) => void) {
  const event = state.queue ?? state.active;
  if (!event || event.isGlobal) throw new GameError("not_ready", "Nav dalībnieka, ko nomainīt.");
  if (state.active?.claimed || state.phase === "CARD_CLAIMED" || state.phase === "ACTIVE_EVENT") {
    throw new GameError("not_ready", "Pēc kartītes saņemšanas dalībnieku vairs nevar nomainīt.");
  }
  const nextPlayer = requirePlayer(state, playerId);
  if (!nextPlayer.eligible) throw new GameError("no_player", "Šis dalībnieks šobrīd netiek izsaukts.");
  if (nextPlayer.id === event.playerId) throw new GameError("invalid", "Šis dalībnieks jau ir izvēlēts.");
  const previousId = event.playerId;
  const previous = state.players.find((player) => player.id === previousId);
  event.playerId = nextPlayer.id;
  event.playerName = nextPlayer.publicName;
  event.qrToken = ctx.id();
  event.extraPlayers = event.extraPlayers.filter((player) => player.id !== nextPlayer.id);
  const card = cardById(event.cardId, state.customCards);
  if (card && (card.selection === "system_one" || card.selection === "system_many") && event.extraPlayers.length === 0) {
    const count = card.selection === "system_one" ? 1 : Math.max(1, card.idealGroup - 1);
    event.extraPlayers = pickExtras(state.players, nextPlayer.id, count, ctx.rng).map((player) => ({
      id: player.id,
      name: player.publicName,
    }));
  }
  if (state.phase === "QR_WAITING" && previous && state.active) {
    previous.callCount = Math.max(0, previous.callCount - 1);
    nextPlayer.callCount += 1;
  }
  note("swap", `Dalībnieks nomainīts uz ${nextPlayer.publicName}`);
}

function clipEnded(
  state: GameState,
  cycleId: string,
  clipToken: string,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
): "ok" | "ignore" {
  if (state.playback.cycleId !== cycleId || state.playback.clipToken !== clipToken) return "ignore";
  if (state.playback.mode === "intro") {
    beginStandby(state, ctx, true);
    note("intro", "Sākuma video pabeigts");
    return "ok";
  }
  if (state.playback.mode === "outro") {
    state.playback.mode = "idle";
    state.playback.announcementUrl = null;
    note("end", "Noslēguma video pabeigts");
    return "ok";
  }
  if (state.playback.mode === "announcement") {
    openQueuedCall(state, ctx, note);
    return "ok";
  }
  if (state.playback.mode !== "standby") return "ignore";
  const playlist = standbyPlaylist(state.videos);
  if (playlist.length === 0) return "ignore";
  const isLast = state.playback.index >= playlist.length - 1;
  if (!isLast) {
    const nextIndex = state.playback.index + 1;
    state.playback.index = nextIndex;
    state.playback.clipId = playlist[nextIndex]?.id ?? null;
    state.playback.clipToken = ctx.id();
    state.playback.clipFailures = 0;
    return "ok";
  }
  // Only the ended event of the last clip in this cycle may open a queued call.
  // A second TV, a reload, or a clip that was cut short by Izsaukt sends a token
  // that no longer matches, so it cannot start a second call or skip ahead.
  if (queueMayRelease(state)) {
    beginAnnouncement(state, ctx, note);
    return "ok";
  }
  beginStandby(state, ctx, false);
  if (!state.playback.cycleIntact) note("cycle", "Bojāts cikls pabeigts bez izsaukuma");
  return "ok";
}

function queueMayRelease(state: GameState): boolean {
  if (!state.queue || state.phase !== "QUEUED" || !state.playback.cycleIntact) return false;
  if (state.queue.armedCycleId && state.queue.armedCycleId !== state.playback.cycleId) return false;
  return true;
}

/** TV finished the whole standby ring locally, without reporting every clip. */
function cycleEnded(
  state: GameState,
  cycleId: string,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
  intact?: boolean,
): "ok" | "ignore" {
  if (state.playback.cycleId !== cycleId) return "ignore";
  if (state.playback.mode !== "standby" && state.playback.mode !== "static") return "ignore";
  if (intact === false) state.playback.cycleIntact = false;
  if (queueMayRelease(state)) {
    beginAnnouncement(state, ctx, note);
    return "ok";
  }
  const broken = !state.playback.cycleIntact;
  beginStandby(state, ctx, false);
  if (broken) note("cycle", "Bojāts cikls pabeigts bez izsaukuma");
  return "ok";
}

/** True while a prepared call is waiting for the current standby ring, or the empty-library test cycle. */
export function waitingForStandbyLoop(state: GameState): boolean {
  if (!state.queue || state.phase !== "QUEUED") return false;
  return state.playback.mode === "standby" || state.playback.mode === "static";
}

function clipFailed(
  state: GameState,
  cycleId: string,
  clipToken: string,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
): "ok" | "ignore" {
  if (state.playback.cycleId !== cycleId || state.playback.clipToken !== clipToken) return "ignore";
  if (state.playback.mode === "intro") {
    warn(state, ctx, "Sākuma video neizdevās atskaņot. Spēle turpinās bez tā.");
    beginStandby(state, ctx, true);
    return "ok";
  }
  if (state.playback.mode === "outro") {
    warn(state, ctx, "Noslēguma video neizdevās atskaņot.");
    state.playback.mode = "idle";
    state.playback.announcementUrl = null;
    return "ok";
  }
  if (state.playback.mode === "announcement") {
    warn(state, ctx, "Izsaukuma video neizdevās atskaņot. Tiek rādīts nākamais solis bez šī video.");
    openQueuedCall(state, ctx, note);
    return "ok";
  }
  if (state.playback.mode !== "standby") return "ignore";
  const playlist = standbyPlaylist(state.videos);
  state.playback.cycleIntact = false;
  state.playback.clipFailures += 1;
  warn(state, ctx, "Standby video neizdevās atskaņot. Cikls netiek uzskatīts par pabeigtu, un izsaukums vēl nesākas.");
  const isLast = state.playback.index >= playlist.length - 1;
  if (!isLast && playlist.length > 0) {
    const nextIndex = state.playback.index + 1;
    state.playback.index = nextIndex;
    state.playback.clipId = playlist[nextIndex]?.id ?? null;
    state.playback.clipToken = ctx.id();
    note("video_error", "Standby klips izlaists pēc atskaņošanas kļūmes");
    return "ok";
  }
  const rounds = state.playback.failureRounds + 1;
  if (rounds >= 3) {
    state.playback.mode = "static";
    state.playback.clipToken = ctx.id();
    state.playback.failureRounds = rounds;
    state.playback.cycleIntact = false;
    warn(state, ctx, "Standby video atkārtoti neielādējas. TV rāda gaidīšanas ekrānu, kamēr bibliotēka nav salabota.");
    note("video_error", "Standby cikls apturēts pēc atkārtotām kļūdām");
    return "ok";
  }
  beginStandby(state, ctx, false, { cycleIntact: false, failureRounds: rounds });
  note("video_error", "Cikls sākts no jauna bez izsaukuma");
  return "ok";
}

function beginAnnouncement(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (!state.queue) return;
  const event = state.queue;
  state.queue = null;
  event.status = "announcing";
  state.active = event;
  if (!event.callVideoUrl) {
    note("announce", event.isGlobal ? `Kopīgais notikums: ${titleOf(state, event)}` : `Izsaukums bez video: ${event.playerName ?? ""}`);
    openQueuedCall(state, ctx, note);
    return;
  }
  state.phase = "ANNOUNCEMENT";
  state.playback = {
    ...state.playback,
    cycleId: ctx.id(),
    clipToken: ctx.id(),
    clipId: null,
    mode: "announcement",
    announcementUrl: event.callVideoUrl,
    index: 0,
  };
  note("announce", event.isGlobal ? `Sākas kopīgais notikums: ${titleOf(state, event)}` : `Sākas izsaukums: ${event.playerName}`);
}

function openQueuedCall(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  const event = state.active;
  if (!event) return;
  if (event.isGlobal) {
    state.playback.mode = "idle";
    state.playback.announcementUrl = null;
    state.playback.clipToken = ctx.id();
    const card = cardById(event.cardId, state.customCards);
    event.status = "active";
    event.publicTitle = card?.title ?? "Kopīgais notikums";
    event.publicLines = card ? [card.summary] : [];
    event.tvHold = false;
    state.phase = "ACTIVE_EVENT";
    note("public", event.publicTitle);
    return;
  }
  const player = state.players.find((item) => item.id === event.playerId);
  if (player) player.callCount += 1;
  event.status = "qr";
  event.qrExpiresAt = null;
  event.tvHold = true;
  state.phase = "QR_WAITING";
  state.playback.mode = "hold";
  state.playback.announcementUrl = event.callVideoUrl;
  state.playback.clipToken = ctx.id();
  note("qr", `QR atvērts: ${event.playerName}`);
}

/** Personal call is on the TV (framed video + QR) until the host continues. */
export function tvCallHeld(state: GameState): boolean {
  const event = state.active;
  if (!event || event.isGlobal || !event.playerName) return false;
  if (event.tvHold === false) return false;
  if (state.phase === "QR_WAITING") return true;
  return event.tvHold === true && (state.phase === "CARD_CLAIMED" || state.phase === "ACTIVE_EVENT");
}

function continueTv(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void) {
  if (!tvCallHeld(state) || !state.active) throw new GameError("not_ready", "TV šobrīd nerāda izsaukumu.");
  const event = state.active;
  const card = cardById(event.cardId, state.customCards);
  const privatelyKept = Boolean(event.claimed && card && (card.privacy === "secret_mission" || card.privacy === "perk"));
  event.tvHold = false;
  if (!event.claimed || privatelyKept) {
    if (!event.claimed) {
      event.outcome = { result: "skipped" };
      event.qrToken = ctx.id();
    }
    event.status = "done";
    remember(state, event);
    state.active = null;
    beginStandby(state, ctx, true);
    note("continue", "TV atgriežas pie standby");
    return;
  }
  releaseTv(state, ctx);
  note("continue", "TV atgriežas pie standby, uzdevums turpinās telefonā");
}

function releaseTv(state: GameState, ctx: Ctx) {
  const playlist = standbyPlaylist(state.videos);
  state.playback = {
    cycleId: ctx.id(),
    index: 0,
    clipId: playlist[0]?.id ?? null,
    clipToken: ctx.id(),
    mode: playlist.length ? "standby" : "static",
    announcementUrl: null,
    cycleIntact: true,
    failureRounds: 0,
    clipFailures: 0,
    cycleStartedAt: iso(ctx.now),
  };
  state.testCycleDeadline = playlist.length === 0 ? iso(ctx.now + TEST_CYCLE_MS) : null;
}

function beginStandby(
  state: GameState,
  ctx: Ctx,
  schedule: boolean,
  keep?: { cycleIntact?: boolean; failureRounds?: number },
) {
  const playlist = standbyPlaylist(state.videos);
  if (state.started) state.phase = state.queue ? "QUEUED" : "STANDBY";
  else state.phase = "LOBBY";
  state.playback = {
    cycleId: ctx.id(),
    index: 0,
    clipId: playlist[0]?.id ?? null,
    clipToken: ctx.id(),
    mode: playlist.length ? "standby" : "static",
    announcementUrl: null,
    cycleIntact: keep?.cycleIntact !== false,
    failureRounds: keep?.failureRounds ?? 0,
    clipFailures: 0,
    cycleStartedAt: iso(ctx.now),
  };
  state.testCycleDeadline = playlist.length === 0 ? iso(ctx.now + TEST_CYCLE_MS) : null;
  if (state.queue) state.queue.armedCycleId = state.playback.cycleId;
  if (schedule && state.started) scheduleAuto(state, ctx);
}

/**
 * Keep the playing clip when the library changes. A missing current clip
 * restarts the ring and does not count as a finished loop, so a queued call
 * still waits. The same clip keeps its token, so a refresh of the list does
 * not restart the video.
 */
function realignPlayback(state: GameState, ctx: Ctx) {
  if (state.playback.mode !== "standby" && state.playback.mode !== "static") return;
  if (state.phase !== "STANDBY" && state.phase !== "QUEUED") return;
  const playlist = standbyPlaylist(state.videos);
  if (playlist.length === 0) {
    if (state.playback.mode === "static") return;
    beginStandby(state, ctx, false);
    return;
  }
  if (state.playback.mode === "static") {
    beginStandby(state, ctx, false);
    return;
  }
  const idx = state.playback.clipId ? playlist.findIndex((clip) => clip.id === state.playback.clipId) : -1;
  if (idx >= 0) {
    state.playback.index = idx;
    return;
  }
  if (state.playback.index < playlist.length) {
    state.playback.clipId = playlist[state.playback.index]?.id ?? null;
    state.playback.clipToken = ctx.id();
    state.playback.clipFailures = 0;
    state.playback.cycleIntact = false;
    return;
  }
  beginStandby(state, ctx, false);
}

function tick(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void): "ok" | "ignore" {
  let changed = false;
  for (const mission of state.missions) {
    if (mission.status === "active" && Date.parse(mission.deadlineAt) <= ctx.now) {
      mission.status = "expired";
      changed = true;
      note("mission_expire", "Slepenās misijas laiks beidzās");
    }
  }
  if (
    !state.paused &&
    state.autoCalls &&
    !state.queue &&
    state.phase === "STANDBY" &&
    state.playback.mode !== "intro" &&
    state.nextAutoAt &&
    Date.parse(state.nextAutoAt) <= ctx.now
  ) {
    try {
      prepare(state, ctx, note, null, null);
      note("auto", "Intervāls sagatavoja nākamo izsaukumu");
      changed = true;
    } catch (error) {
      if (error instanceof GameError) {
        warn(state, ctx, error.message);
        state.nextAutoAt = iso(ctx.now + 60_000);
        changed = true;
      } else throw error;
    }
  }
  if (
    state.playback.mode === "static" &&
    state.testCycleDeadline &&
    Date.parse(state.testCycleDeadline) <= ctx.now &&
    (state.phase === "STANDBY" || state.phase === "QUEUED")
  ) {
    return runVirtualCycle(state, ctx, note);
  }
  return changed ? "ok" : "ignore";
}

function completeTestCycle(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void): "ok" | "ignore" {
  if (standbyPlaylist(state.videos).length > 0) throw new GameError("not_ready", "Testa cikls ir tikai tad, ja nav standby video.");
  if (state.phase !== "STANDBY" && state.phase !== "QUEUED") throw new GameError("not_ready", "Testa ciklu tagad nevar pabeigt.");
  return runVirtualCycle(state, ctx, note);
}

function runVirtualCycle(state: GameState, ctx: Ctx, note: (type: string, summary: string) => void): "ok" {
  if (state.queue && state.phase === "QUEUED" && queueMayRelease(state)) {
    note("test_cycle", "Testa cikls pabeigts");
    beginAnnouncement(state, ctx, note);
    return "ok";
  }
  beginStandby(state, ctx, false);
  note("test_cycle", "Testa cikls sākas no jauna");
  return "ok";
}

function claim(
  state: GameState,
  qrToken: string,
  playerId: string,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
): "ok" | "ignore" {
  const player = requirePlayer(state, playerId);
  const event = state.active;
  if (!event || event.qrToken !== qrToken || event.isGlobal) throw new GameError("not_found", "Kartīte nav aktīva.");
  if (event.playerId !== player.id) throw new GameError("wrong_player", "Šī kartīte nav tev.");
  if (event.qrExpiresAt && Date.parse(event.qrExpiresAt) <= ctx.now && !tvCallHeld(state)) {
    throw new GameError("expired", "QR laiks ir beidzies.");
  }
  if (event.claimed) return "ignore";
  if (state.phase !== "QR_WAITING") throw new GameError("not_found", "Kartīte nav aktīva.");
  const card = cardById(event.cardId, state.customCards);
  if (!card) throw new GameError("no_card", "Kartīte nav atrasta.");
  event.claimed = true;
  if (card.privacy === "secret_mission") {
    state.missions.push({
      id: ctx.id(),
      eventId: event.eventId,
      qrToken: event.qrToken,
      playerId: player.id,
      cardId: card.id,
      title: card.title,
      text: card.summary,
      rules: card.rules,
      status: "active",
      deadlineAt: iso(ctx.now + state.settings.missionSeconds * 1000),
      completedAt: null,
    });
    event.claimed = true;
    event.tvHold = true;
    event.outcome = { result: "completed" };
    note("mission", `${player.publicName} saņēma slepeno misiju`);
    return "ok";
  }
  if (card.privacy === "perk") {
    state.perks.push({
      id: ctx.id(),
      eventId: event.eventId,
      qrToken: event.qrToken,
      playerId: player.id,
      cardId: card.id,
      name: card.title,
      description: card.summary,
      status: "available",
      usedAt: null,
    });
    event.claimed = true;
    event.tvHold = true;
    event.outcome = { result: "completed" };
    note("perk", `${player.publicName} saņēma priekšrocību`);
    return "ok";
  }
  event.status = "claimed";
  state.phase = "CARD_CLAIMED";
  note("claim", `${player.publicName} atvēra kartīti`);
  if (card.selection === "none" || card.selection === "system_one" || card.selection === "system_many") {
    publishEvent(state, card.title, []);
  }
  return "ok";
}

function decline(state: GameState, playerId: string, ctx: Ctx, note: (type: string, summary: string) => void) {
  const event = state.active;
  if (!event || event.playerId !== playerId || !event.claimed) throw new GameError("not_ready", "Nav kartītes, no kuras atteikties.");
  const card = cardById(event.cardId, state.customCards);
  if (card && !card.allowsDecline) throw new GameError("invalid", "No šī notikuma nevar atteikties.");
  event.outcome = { result: "declined" };
  event.status = "done";
  remember(state, event);
  state.active = null;
  beginStandby(state, ctx, true);
  note("decline", "Dalībnieks atteicās no uzdevuma");
}

function submitSelection(
  state: GameState,
  action: Extract<Action, { type: "submit_selection" }>,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
) {
  const event = state.active;
  if (!event || state.phase !== "CARD_CLAIMED" || event.playerId !== action.playerId) {
    throw new GameError("not_ready", "Šobrīd izvēli nevar apstiprināt.");
  }
  const card = cardById(event.cardId, state.customCards);
  if (!card) throw new GameError("no_card", "Kartīte nav atrasta.");
  const unique = [...new Set(action.partnerIds)];
  if (unique.length !== action.partnerIds.length) throw new GameError("invalid", "Vienu cilvēku nevar izvēlēties vairākas reizes.");
  if (unique.includes(action.playerId)) throw new GameError("invalid", "Sevi izvēlēties nevar.");
  const partners = unique.map((id) => requirePlayer(state, id));
  if (card.selection === "player_one" || card.id === "duel" || (card.selection === "player_choice" && action.mode !== "group" && card.id === "choice" && action.mode === "duel")) {
    if (partners.length !== 1) throw new GameError("invalid", "Jāizvēlas tieši viens cilvēks.");
  }
  if (card.selection === "player_one") {
    event.extraPlayers = partners.map((player) => ({ id: player.id, name: player.publicName }));
    publishEvent(state, card.title, []);
    note("selection", `${event.playerName} izvēlējās ${partners[0].publicName}`);
    return;
  }
  if (card.selection === "player_many") {
    if (partners.length < 1) throw new GameError("invalid", "Jāizvēlas vismaz viens cilvēks.");
    event.extraPlayers = partners.map((player) => ({ id: player.id, name: player.publicName }));
    publishEvent(state, card.title, []);
    note("selection", "Komanda apstiprināta");
    return;
  }
  if (card.selection !== "player_choice") throw new GameError("invalid", "Šai kartītei nav šādas izvēles.");
  const mode = card.id === "duel" ? "duel" : action.mode;
  if (mode !== "duel" && mode !== "group") throw new GameError("invalid", "Jāizvēlas duelis vai kopīga aktivitāte.");
  if (mode === "duel" && partners.length !== 1) throw new GameError("invalid", "Duelim jāizvēlas tieši viens pretinieks.");
  if (mode === "group" && partners.length < 1) throw new GameError("invalid", "Jāizvēlas vismaz viens dalībnieks.");
  const title = sanitizeActivity(action.activityTitle ?? "");
  if (!title) throw new GameError("invalid", "Aktivitātes nosaukumam jābūt no 2 līdz 80 simboliem.");
  const rules = sanitizeActivity(action.activityRules ?? "", 280) ?? "";
  event.choice = {
    mode,
    title,
    rules,
    playerIds: partners.map((player) => player.id),
    playerNames: partners.map((player) => player.publicName),
  };
  event.extraPlayers = partners.map((player) => ({ id: player.id, name: player.publicName }));
  publishEvent(state, title, rules ? [rules] : []);
  note("choice", `Publiskā aktivitāte: ${title}`);
  void ctx;
}

function publishEvent(state: GameState, title: string, lines: string[]) {
  if (!state.active) return;
  state.active.status = "active";
  state.active.publicTitle = title;
  state.active.publicLines = lines;
  state.phase = "ACTIVE_EVENT";
}

function completeMission(
  state: GameState,
  missionId: string,
  playerId: string,
  ctx: Ctx,
  note: (type: string, summary: string) => void,
) {
  const mission = state.missions.find((item) => item.id === missionId && item.playerId === playerId);
  if (!mission) throw new GameError("not_found", "Misija nav atrasta.");
  if (mission.status !== "active") throw new GameError("invalid", "Šo misiju vairs nevar atzīmēt.");
  mission.status = "pending_confirm";
  mission.completedAt = iso(ctx.now);
  note("mission_done", "Dalībnieks atzīmēja misiju kā izpildītu");
}

function reviewMission(
  state: GameState,
  missionId: string,
  status: "confirmed" | "failed",
  note: (type: string, summary: string) => void,
) {
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission) throw new GameError("not_found", "Misija nav atrasta.");
  mission.status = status;
  note("mission_review", status === "confirmed" ? "Misija apstiprināta" : "Misija nav izpildīta");
}

function requestPerk(state: GameState, perkId: string, playerId: string, note: (type: string, summary: string) => void) {
  const perk = state.perks.find((item) => item.id === perkId && item.playerId === playerId);
  if (!perk) throw new GameError("not_found", "Priekšrocība nav atrasta.");
  if (perk.status === "used") throw new GameError("used", "Šī priekšrocība jau ir izmantota.");
  perk.status = "pending";
  note("perk_request", `${perk.name} gaida apstiprinājumu`);
}

function confirmPerk(state: GameState, perkId: string, ctx: Ctx, note: (type: string, summary: string) => void) {
  const perk = state.perks.find((item) => item.id === perkId);
  if (!perk) throw new GameError("not_found", "Priekšrocība nav atrasta.");
  if (perk.status === "used") throw new GameError("used", "Šī priekšrocība jau ir izmantota.");
  perk.status = "used";
  perk.usedAt = iso(ctx.now);
  note("perk_used", `${perk.name} izmantota`);
}

function closeEvent(
  state: GameState,
  result: "completed" | "failed",
  ctx: Ctx,
  note: (type: string, summary: string) => void,
  winnerId?: string | null,
) {
  if (!state.active || (state.phase !== "ACTIVE_EVENT" && state.phase !== "CARD_CLAIMED")) {
    throw new GameError("not_ready", "Nav aktīva uzdevuma.");
  }
  let winnerName: string | undefined;
  if (winnerId) {
    const winner = requirePlayer(state, winnerId);
    winnerName = winner.publicName;
  }
  state.active.outcome = { result, winnerId: winnerId ?? undefined, winnerName };
  state.active.status = "done";
  remember(state, state.active);
  state.active = null;
  beginStandby(state, ctx, true);
  note(result, winnerName ? `Uzdevums pabeigts. Uzvarētājs: ${winnerName}` : "Uzdevums pabeigts");
}

function scheduleAuto(state: GameState, ctx: Ctx) {
  if (!state.autoCalls || state.paused || state.queue || state.phase !== "STANDBY" || state.playback.mode === "intro") {
    state.nextAutoAt = null;
    return;
  }
  const min = state.settings.minIntervalSec;
  const max = state.settings.maxIntervalSec;
  const span = Math.max(0, max - min);
  const seconds = min + Math.floor(ctx.rng() * (span + 1));
  state.nextAutoAt = iso(ctx.now + seconds * 1000);
}

function remember(state: GameState, event: LiveEvent) {
  state.recentEvents = [{ ...event }, ...state.recentEvents].slice(0, 40);
}

function warn(state: GameState, ctx: Ctx, message: string) {
  state.warnings = [{ id: ctx.id(), at: iso(ctx.now), message }, ...state.warnings].slice(0, 20);
}

function titleOf(state: GameState, event: LiveEvent): string {
  return cardById(event.cardId, state.customCards)?.title ?? event.cardId;
}

function upsertCard(state: GameState, card: CardDef, note: (type: string, summary: string) => void) {
  const clean = validateCustomCard(card);
  const index = state.customCards.findIndex((item) => item.id === clean.id);
  if (index >= 0) state.customCards[index] = clean;
  else state.customCards.push(clean);
  note("card", `Kartīte saglabāta: ${clean.title}`);
}

function deleteCard(state: GameState, cardId: string, note: (type: string, summary: string) => void) {
  if (isBuiltinCard(cardId) && !state.customCards.some((card) => card.id === cardId)) {
    throw new GameError("invalid", "Iebūvētu kartīti nevar dzēst.");
  }
  state.customCards = state.customCards.filter((card) => card.id !== cardId);
  note("card", "Kartīte noņemta");
}

export function validateCustomCard(card: CardDef): CardDef {
  if (!/^[a-z0-9_]{3,40}$/.test(card.id)) throw new GameError("invalid", "Kartītes ID drīkst saturēt tikai mazos burtus, ciparus un _.");
  const title = sanitizeActivity(card.title, 60);
  const summary = sanitizeActivity(card.summary, 280);
  if (!title || !summary) throw new GameError("invalid", "Kartītei vajag nosaukumu un aprakstu.");
  const categories = ["FLASH", "PAIR", "TEAM", "MISSION", "PERK", "CHOICE", "GLOBAL"];
  if (!categories.includes(card.category)) throw new GameError("invalid", "Nederīga kategorija.");
  if (!/^izsaukums_[a-z0-9_]+\.mp4$/.test(card.videoFile) && !/^special_[a-z0-9_]+\.mp4$/.test(card.videoFile)) {
    throw new GameError("invalid", "Video failam jābūt formā izsaukums_id.mp4.");
  }
  const rules = (card.rules ?? []).map((rule) => sanitizeActivity(rule, 180)).filter((rule): rule is string => Boolean(rule)).slice(0, 8);
  return {
    ...card,
    title,
    summary,
    rules,
    custom: true,
    durationSeconds: Math.max(0, Math.min(3600, Math.floor(card.durationSeconds || 0))),
    minPlayers: Math.max(1, Math.min(30, Math.floor(card.minPlayers || 1))),
    idealGroup: Math.max(1, Math.min(12, Math.floor(card.idealGroup || card.minPlayers || 1))),
    categoryVideoFile: card.categoryVideoFile,
    allowsDecline: card.allowsDecline !== false,
  };
}

export function normalizeSettings(input: Settings): Settings {
  const minIntervalSec = clampInt(input.minIntervalSec, 30, 7200);
  const maxIntervalSec = clampInt(input.maxIntervalSec, minIntervalSec, 10800);
  const qrSeconds = clampInt(input.qrSeconds, 10, 300);
  const missionSeconds = clampInt(input.missionSeconds, 60, 4 * 60 * 60);
  const activeCategories = (input.activeCategories ?? []).filter((category): category is AutoCategory =>
    ["FLASH", "PAIR", "TEAM", "MISSION", "PERK", "CHOICE"].includes(category),
  );
  const weights = { ...DEFAULT_SETTINGS.categoryWeights };
  for (const key of Object.keys(weights) as AutoCategory[]) {
    const value = input.categoryWeights?.[key];
    weights[key] = clampInt(typeof value === "number" ? value : weights[key], 0, 100);
  }
  return {
    minIntervalSec,
    maxIntervalSec,
    qrSeconds,
    missionSeconds,
    categoryWeights: weights,
    activeCategories: activeCategories.length ? [...new Set(activeCategories)] : [],
    standbyMuted: Boolean(input.standbyMuted),
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function sanitizeName(input: string): string | null {
  const clean = input
    .normalize("NFKC")
    .replace(/[<>&"'`]/g, "")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length < 1 || clean.length > 24) return null;
  return clean;
}

export function sanitizeActivity(input: string, max = 80): string | null {
  const clean = input
    .normalize("NFKC")
    .replace(/[<>&"'`]/g, "")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length < 2 || clean.length > max) return null;
  return clean;
}

export function publicPhase(phase: Phase): Phase {
  return phase === "QUEUED" ? "STANDBY" : phase;
}
