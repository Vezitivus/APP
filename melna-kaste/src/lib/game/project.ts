import { cardById, catalog } from "./cards";
import { specialEnd, standbyPlaylist, standbySlots } from "./videos";
import type { GameState, Mission, Perk, Phase, Player } from "./types";
import { publicPhase, tvCallHeld, waitingForStandbyLoop } from "./engine";

export interface TvState {
  version: number;
  phase: Phase;
  paused: boolean;
  code: string;
  playerCount: number;
  serverNow: string;
  standbyMuted: boolean;
  audioBlocked: boolean;
  playback: {
    mode: GameState["playback"]["mode"];
    cycleId: string;
    clipToken: string;
    index: number;
    total: number;
    clipUrl: string | null;
    nextUrl: string | null;
    announcementUrl: string | null;
  };
  screen:
    | { kind: "lobby" }
    | { kind: "standby" }
    | { kind: "static" }
    | { kind: "intro" }
    | { kind: "announcement" }
    | { kind: "call"; name: string; title: string; qrPath: string; videoUrl: string | null }
    | { kind: "claimed"; name: string }
    | { kind: "event"; title: string; lines: string[]; names: string[] }
    | { kind: "finished" };
  /** Only for the paired TV, so the call clip can be preloaded. Omitted from the public feed. */
  preloadCallUrl: string | null;
  endVideoUrl: string | null;
}

export function toTvState(state: GameState, now: number, options?: { includePreload?: boolean }): TvState {
  const playlist = standbyPlaylist(state.videos);
  const current = playlist[state.playback.index] ?? null;
  const next = playlist.length ? playlist[(state.playback.index + 1) % playlist.length] : null;
  const phase = publicPhase(state.phase);
  return {
    version: state.version,
    phase,
    paused: state.paused,
    code: state.code,
    playerCount: state.players.filter((player) => !player.removed).length,
    serverNow: new Date(now).toISOString(),
    standbyMuted: state.settings.standbyMuted,
    audioBlocked: state.audioBlocked,
    playback: {
      mode: state.playback.mode,
      cycleId: state.playback.cycleId,
      clipToken: state.playback.clipToken,
      index: state.playback.index,
      total: playlist.length,
      clipUrl: state.playback.mode === "standby" ? current?.url ?? null : null,
      nextUrl: state.playback.mode === "standby" ? next?.url ?? null : null,
      announcementUrl: state.playback.announcementUrl,
    },
    screen: tvScreen(state),
    preloadCallUrl: options?.includePreload && state.queue ? state.queue.callVideoUrl : null,
    endVideoUrl: state.phase === "FINISHED" ? specialEnd(state.videos)?.url ?? null : null,
  };
}

function tvScreen(state: GameState): TvState["screen"] {
  if (state.phase === "LOBBY") return { kind: "lobby" };
  if (state.phase === "FINISHED") return { kind: "finished" };
  if (state.playback.mode === "intro") return { kind: "intro" };
  if (state.playback.mode === "announcement" || state.phase === "ANNOUNCEMENT") return { kind: "announcement" };
  if (tvCallHeld(state) && state.active) return callScreen(state);
  if (state.phase === "ACTIVE_EVENT" && state.active?.isGlobal) return eventScreen(state);
  if (
    (state.phase === "CARD_CLAIMED" || state.phase === "ACTIVE_EVENT") &&
    state.active &&
    !state.active.isGlobal &&
    state.active.tvHold === false
  ) {
    return standbyScreen(state);
  }
  if (state.phase === "CARD_CLAIMED" && state.active?.playerName) {
    return { kind: "claimed", name: state.active.playerName };
  }
  if (state.phase === "ACTIVE_EVENT" && state.active) return eventScreen(state);
  return standbyScreen(state);
}

function callScreen(state: GameState): TvState["screen"] {
  const event = state.active!;
  const card = cardById(event.cardId, state.customCards);
  return {
    kind: "call",
    name: event.playerName ?? "",
    title: event.publicTitle || card?.title || "",
    qrPath: `/mission/${event.qrToken}`,
    videoUrl: event.callVideoUrl,
  };
}

function eventScreen(state: GameState): TvState["screen"] {
  const event = state.active!;
  const names = [event.playerName, ...event.extraPlayers.map((player) => player.name)].filter((name): name is string => Boolean(name));
  return {
    kind: "event",
    title: event.publicTitle ?? "",
    lines: event.publicLines,
    names,
  };
}

function standbyScreen(state: GameState): TvState["screen"] {
  if (state.playback.mode === "static" || standbyPlaylist(state.videos).length === 0) return { kind: "static" };
  return { kind: "standby" };
}

export interface AdminState {
  id: string;
  code: string;
  phase: Phase;
  paused: boolean;
  autoCalls: boolean;
  version: number;
  settings: GameState["settings"];
  serverNow: string;
  playback: {
    mode: GameState["playback"]["mode"];
    index: number;
    total: number;
    current: string | null;
    next: string | null;
    cycleIntact: boolean;
    failureRounds: number;
  };
  queue: null | {
    eventId: string;
    playerId: string | null;
    playerName: string | null;
    cardId: string;
    cardTitle: string;
    cardSummary: string;
    videoLevel: string;
    videoUrl: string | null;
  };
  active: null | {
    eventId: string;
    playerId: string | null;
    playerName: string | null;
    cardId: string;
    cardTitle: string;
    cardSummary: string;
    expiresAt: string | null;
    claimed: boolean;
    extraPlayers: { id: string; name: string }[];
    publicTitle: string | null;
    choiceTitle: string | null;
    tvHold: boolean;
  };
  players: {
    id: string;
    name: string;
    publicName: string;
    callCount: number;
    eligible: boolean;
    removed: boolean;
    lastSeenAt: string | null;
    online: boolean;
  }[];
  missions: {
    id: string;
    playerId: string;
    playerName: string;
    title: string;
    text: string;
    status: Mission["status"];
    deadlineAt: string;
  }[];
  perks: {
    id: string;
    playerId: string;
    playerName: string;
    name: string;
    description: string;
    status: Perk["status"];
  }[];
  warnings: GameState["warnings"];
  history: GameState["history"];
  audioBlocked: boolean;
  nextAutoAt: string | null;
  testCycleDeadline: string | null;
  waitingForLoop: boolean;
  standbySlots: {
    slot: number;
    expectedFilename: string;
    present: boolean;
    filename: string | null;
    current: boolean;
  }[];
  catalog: { id: string; title: string; category: string; minPlayers: number; videoFile: string }[];
  joinPath: string;
}

export function toAdminState(state: GameState, now: number): AdminState {
  const playlist = standbyPlaylist(state.videos);
  const current = playlist[state.playback.index] ?? null;
  const next = playlist.length ? playlist[(state.playback.index + 1) % playlist.length] : null;
  const nameOf = (id: string) => state.players.find((player) => player.id === id)?.publicName ?? "";
  return {
    id: state.id,
    code: state.code,
    phase: state.phase,
    paused: state.paused,
    autoCalls: state.autoCalls,
    version: state.version,
    settings: state.settings,
    serverNow: new Date(now).toISOString(),
    playback: {
      mode: state.playback.mode,
      index: state.playback.index,
      total: playlist.length,
      current: current?.filename ?? null,
      next: next?.filename ?? null,
      cycleIntact: state.playback.cycleIntact,
      failureRounds: state.playback.failureRounds,
    },
    queue: state.queue
      ? {
          eventId: state.queue.eventId,
          playerId: state.queue.playerId,
          playerName: state.queue.playerName,
          cardId: state.queue.cardId,
          cardTitle: cardById(state.queue.cardId, state.customCards)?.title ?? state.queue.cardId,
          cardSummary: cardById(state.queue.cardId, state.customCards)?.summary ?? "",
          videoLevel: state.queue.callVideoLevel,
          videoUrl: state.queue.callVideoUrl,
        }
      : null,
    active: state.active
      ? {
          eventId: state.active.eventId,
          playerId: state.active.playerId,
          playerName: state.active.playerName,
          cardId: state.active.cardId,
          cardTitle: cardById(state.active.cardId, state.customCards)?.title ?? state.active.cardId,
          cardSummary: cardById(state.active.cardId, state.customCards)?.summary ?? "",
          expiresAt: state.active.qrExpiresAt,
          claimed: state.active.claimed,
          extraPlayers: state.active.extraPlayers,
          publicTitle: state.active.publicTitle,
          choiceTitle: state.active.choice?.title ?? null,
          tvHold: tvCallHeld(state),
        }
      : null,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      publicName: player.publicName,
      callCount: player.callCount,
      eligible: player.eligible,
      removed: player.removed,
      lastSeenAt: player.lastSeenAt,
      online: Boolean(player.lastSeenAt && now - Date.parse(player.lastSeenAt) < 30_000),
    })),
    missions: state.missions.map((mission) => ({
      id: mission.id,
      playerId: mission.playerId,
      playerName: nameOf(mission.playerId),
      title: mission.title,
      text: mission.text,
      status: mission.status,
      deadlineAt: mission.deadlineAt,
    })),
    perks: state.perks.map((perk) => ({
      id: perk.id,
      playerId: perk.playerId,
      playerName: nameOf(perk.playerId),
      name: perk.name,
      description: perk.description,
      status: perk.status,
    })),
    warnings: state.warnings,
    history: state.history,
    audioBlocked: state.audioBlocked,
    nextAutoAt: state.nextAutoAt,
    testCycleDeadline: state.testCycleDeadline,
    waitingForLoop: waitingForStandbyLoop(state),
    standbySlots: standbySlots(state.videos).map((slot) => ({
      slot: slot.slot,
      expectedFilename: slot.expectedFilename,
      present: slot.present,
      filename: slot.filename,
      current: state.playback.mode === "standby" && Boolean(current && slot.filename && slot.filename === current.filename),
    })),
    catalog: catalog(state.customCards).map((card) => ({
      id: card.id,
      title: card.title,
      category: card.category,
      minPlayers: card.minPlayers,
      videoFile: card.videoFile,
    })),
    joinPath: `/join?code=${state.code}`,
  };
}

export interface PlayerState {
  playerId: string;
  publicName: string;
  serverNow: string;
  phase: Phase;
  roster: { id: string; publicName: string }[];
  card: null | {
    eventId: string;
    qrToken: string;
    cardId: string;
    title: string;
    summary: string;
    rules: string[];
    durationSeconds: number;
    category: string;
    selection: string;
    partners: { id: string; name: string }[];
    needsPartner: boolean;
    needsChoice: boolean;
    duelOnly: boolean;
    expiresAt: string | null;
  };
  missions: Mission[];
  perks: Perk[];
}

export function toPlayerState(state: GameState, player: Player, now: number): PlayerState {
  const event = state.active && state.active.playerId === player.id && state.active.claimed ? state.active : null;
  const card = event ? cardById(event.cardId, state.customCards) : undefined;
  const showCard = Boolean(event && card && card.privacy !== "secret_mission" && card.privacy !== "perk");
  return {
    playerId: player.id,
    publicName: player.publicName,
    serverNow: new Date(now).toISOString(),
    phase: publicPhase(state.phase),
    roster: state.players
      .filter((item) => !item.removed && item.id !== player.id)
      .map((item) => ({ id: item.id, publicName: item.publicName })),
    card:
      showCard && event && card
        ? {
            eventId: event.eventId,
            qrToken: event.qrToken,
            cardId: card.id,
            title: card.title,
            summary: card.summary,
            rules: card.rules,
            durationSeconds: card.durationSeconds,
            category: card.category,
            selection: card.selection,
            partners: event.extraPlayers,
            needsPartner: state.phase === "CARD_CLAIMED" && (card.selection === "player_one" || card.selection === "player_many"),
            needsChoice: state.phase === "CARD_CLAIMED" && card.selection === "player_choice",
            duelOnly: card.id === "duel",
            expiresAt: event.qrExpiresAt,
          }
        : null,
    missions: state.missions.filter((mission) => mission.playerId === player.id),
    perks: state.perks.filter((perk) => perk.playerId === player.id),
  };
}

export function missionView(state: GameState, qrToken: string, playerId: string | null, now: number) {
  const mission = state.missions.find((item) => item.qrToken === qrToken);
  if (mission) {
    if (!playerId) return { status: "need_session" as const };
    if (playerId !== mission.playerId) return { status: "forbidden" as const };
    return { status: "mission" as const, mission };
  }
  const perk = state.perks.find((item) => item.qrToken === qrToken);
  if (perk) {
    if (!playerId) return { status: "need_session" as const };
    if (playerId !== perk.playerId) return { status: "forbidden" as const };
    return { status: "perk" as const, perk };
  }
  const event = state.active && state.active.qrToken === qrToken ? state.active : null;
  if (!event || event.isGlobal) return { status: "inactive" as const };
  if (event.qrExpiresAt && Date.parse(event.qrExpiresAt) <= now && event.tvHold === false) return { status: "expired" as const };
  if (!playerId) return { status: "need_session" as const };
  if (playerId !== event.playerId) return { status: "forbidden" as const };
  const card = cardById(event.cardId, state.customCards);
  if (!card) return { status: "inactive" as const };
  if (!event.claimed) return { status: "ready" as const, expiresAt: event.qrExpiresAt };
  return {
    status: "card" as const,
    card: {
      title: card.title,
      summary: card.summary,
      rules: card.rules,
      durationSeconds: card.durationSeconds,
      selection: card.selection,
      category: card.category,
      partners: event.extraPlayers,
      needsPartner: state.phase === "CARD_CLAIMED" && (card.selection === "player_one" || card.selection === "player_many"),
      needsChoice: state.phase === "CARD_CLAIMED" && card.selection === "player_choice",
      duelOnly: card.id === "duel",
      claimed: event.claimed,
      expiresAt: event.qrExpiresAt,
    },
    roster: state.players.filter((item) => !item.removed && item.id !== playerId).map((item) => ({ id: item.id, publicName: item.publicName })),
  };
}
