export type Phase =
  | "LOBBY"
  | "STANDBY"
  | "QUEUED"
  | "ANNOUNCEMENT"
  | "QR_WAITING"
  | "CARD_CLAIMED"
  | "ACTIVE_EVENT"
  | "FINISHED";

export type Category = "FLASH" | "PAIR" | "TEAM" | "MISSION" | "PERK" | "CHOICE" | "GLOBAL";

export type AutoCategory = Exclude<Category, "GLOBAL">;

export type SelectionMode =
  | "none"
  | "system_one"
  | "system_many"
  | "player_one"
  | "player_many"
  | "player_choice";

export type Privacy = "private_card" | "public_event" | "secret_mission" | "perk";

export type VideoLevel = "task" | "category" | "universal" | "special" | "none";

export interface CardDef {
  id: string;
  title: string;
  category: Category;
  summary: string;
  rules: string[];
  durationSeconds: number;
  minPlayers: number;
  idealGroup: number;
  selection: SelectionMode;
  privacy: Privacy;
  /** Exact Cloudinary filename in melna-kaste/calls/. */
  videoFile: string;
  /** Category fallback. Null skips straight to the universal call. */
  categoryVideoFile: string | null;
  allowsDecline: boolean;
  custom?: boolean;
}

export interface Settings {
  minIntervalSec: number;
  maxIntervalSec: number;
  qrSeconds: number;
  missionSeconds: number;
  categoryWeights: Record<AutoCategory, number>;
  activeCategories: AutoCategory[];
  standbyMuted: boolean;
}

export interface Player {
  id: string;
  name: string;
  publicName: string;
  sessionHash: string;
  recoveryHash: string;
  callCount: number;
  eligible: boolean;
  removed: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface VideoAsset {
  id: string;
  publicId: string;
  folder: "standby" | "calls" | "special";
  filename: string;
  url: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface LiveEvent {
  eventId: string;
  qrToken: string;
  qrExpiresAt: string | null;
  playerId: string | null;
  playerName: string | null;
  extraPlayers: { id: string; name: string }[];
  cardId: string;
  category: Category;
  callVideoLevel: VideoLevel;
  callVideoUrl: string | null;
  status: "queued" | "announcing" | "qr" | "claimed" | "active" | "done";
  claimed: boolean;
  selection: SelectionMode;
  publicTitle: string | null;
  publicLines: string[];
  choice: null | {
    mode: "duel" | "group";
    title: string;
    rules: string;
    playerIds: string[];
    playerNames: string[];
  };
  outcome: null | {
    result: "completed" | "failed" | "declined" | "expired" | "skipped";
    winnerId?: string;
    winnerName?: string;
  };
  isGlobal: boolean;
  isIntro?: boolean;
}

export interface Mission {
  id: string;
  eventId: string;
  qrToken: string;
  playerId: string;
  cardId: string;
  title: string;
  text: string;
  rules: string[];
  status: "active" | "pending_confirm" | "confirmed" | "failed" | "expired";
  deadlineAt: string;
  completedAt: string | null;
}

export interface Perk {
  id: string;
  eventId: string;
  qrToken: string;
  playerId: string;
  cardId: string;
  name: string;
  description: string;
  status: "available" | "pending" | "used";
  usedAt: string | null;
}

export interface Playback {
  cycleId: string;
  index: number;
  clipId: string | null;
  clipToken: string;
  mode: "idle" | "standby" | "announcement" | "intro" | "static";
  announcementUrl: string | null;
  cycleIntact: boolean;
  failureRounds: number;
  clipFailures: number;
}

export interface HistoryEntry {
  id: string;
  at: string;
  type: string;
  summary: string;
}

export interface Warning {
  id: string;
  at: string;
  message: string;
}

export interface GameState {
  id: string;
  code: string;
  phase: Phase;
  paused: boolean;
  autoCalls: boolean;
  version: number;
  settings: Settings;
  players: Player[];
  playback: Playback;
  queue: LiveEvent | null;
  active: LiveEvent | null;
  missions: Mission[];
  perks: Perk[];
  videos: VideoAsset[];
  customCards: CardDef[];
  usedCards: Partial<Record<Category, string[]>>;
  warnings: Warning[];
  audioBlocked: boolean;
  nextAutoAt: string | null;
  testCycleDeadline: string | null;
  history: HistoryEntry[];
  recentEvents: LiveEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Ctx {
  now: number;
  /** Must return a number in [0, 1). */
  rng: () => number;
  id: () => string;
}

export interface ApplyResult {
  state: GameState;
  appended: HistoryEntry[];
  error?: { code: string; message: string };
  ignored?: boolean;
  issued?: {
    testPlayers?: { id: string; name: string; recoveryCode: string }[];
    recoveryCode?: string;
    playerId?: string;
  };
}

export type Action =
  | { type: "add_player"; name: string; sessionHash: string; recoveryHash: string }
  | { type: "rename_player"; playerId: string; name: string }
  | { type: "remove_player"; playerId: string }
  | { type: "set_eligible"; playerId: string; eligible: boolean }
  | { type: "add_test_players"; players: { sessionHash: string; recoveryHash: string; recoveryCode: string }[] }
  | { type: "reissue_recovery"; playerId: string; recoveryHash: string; recoveryCode: string }
  | { type: "rotate_session"; playerId: string; sessionHash: string }
  | { type: "update_settings"; patch: Partial<Settings> }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "finish" }
  | { type: "reset" }
  | { type: "set_auto"; enabled: boolean }
  | { type: "prepare"; playerId?: string | null; cardId?: string | null }
  | { type: "accelerate" }
  | { type: "skip" }
  | { type: "swap_player"; playerId: string }
  | { type: "clip_ended"; cycleId: string; clipToken: string }
  | { type: "clip_failed"; cycleId: string; clipToken: string }
  | { type: "tick" }
  | { type: "complete_test_cycle" }
  | { type: "claim"; qrToken: string; playerId: string }
  | { type: "decline"; playerId: string }
  | {
      type: "submit_selection";
      playerId: string;
      partnerIds: string[];
      activityTitle?: string;
      activityRules?: string;
      mode?: "duel" | "group";
    }
  | { type: "complete_mission"; missionId: string; playerId: string }
  | { type: "confirm_mission"; missionId: string }
  | { type: "fail_mission"; missionId: string }
  | { type: "request_perk"; perkId: string; playerId: string }
  | { type: "confirm_perk"; perkId: string }
  | { type: "complete_event"; winnerId?: string | null }
  | { type: "fail_event" }
  | { type: "activate_global"; cardId: string }
  | { type: "sync_videos"; videos: VideoAsset[] }
  | { type: "audio_blocked"; blocked: boolean }
  | { type: "upsert_card"; card: CardDef }
  | { type: "delete_card"; cardId: string };

export const AUTO_CATEGORIES: AutoCategory[] = ["FLASH", "PAIR", "TEAM", "MISSION", "PERK", "CHOICE"];

export const DEFAULT_SETTINGS: Settings = {
  minIntervalSec: 600,
  maxIntervalSec: 1200,
  qrSeconds: 60,
  missionSeconds: 1800,
  categoryWeights: { FLASH: 25, PAIR: 22, TEAM: 16, MISSION: 18, PERK: 10, CHOICE: 9 },
  activeCategories: [...AUTO_CATEGORIES],
  standbyMuted: true,
};

export const TEST_CYCLE_MS = 20_000;
export const TEST_PLAYER_NAMES = ["Jānis", "Artūrs", "Mārtiņš", "Klāvs", "Edgars", "Roberts"];
