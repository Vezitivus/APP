import { apply, createGame as blankGame } from "@/lib/game/engine";
import { toTvState } from "@/lib/game/project";
import { normalizeGame } from "@/lib/game/engine";
import type { Action, ApplyResult, Ctx, GameState, LiveEvent, Player } from "@/lib/game/types";
import { roomCode } from "@/lib/auth/crypto";
import { sql, type Tx } from "./sql";

function asJson(tx: Tx, value: unknown) {
  return tx.json(JSON.parse(JSON.stringify(value)));
}

export class RateLimitError extends Error {
  code = "rate";
}

export async function limit(bucket: string, maxHits: number, windowMs: number): Promise<void> {
  const db = sql();
  const now = new Date();
  await db.begin(async (tx) => {
    const [row] = await tx<{ window_start: Date; hits: number }[]>`
      select window_start, hits from rate_limits where bucket = ${bucket} for update
    `;
    if (!row || now.getTime() - new Date(row.window_start).getTime() >= windowMs) {
      await tx`
        insert into rate_limits (bucket, window_start, hits) values (${bucket}, ${now}, 1)
        on conflict (bucket) do update set window_start = ${now}, hits = 1
      `;
      return;
    }
    if (row.hits >= maxHits) throw new RateLimitError("rate");
    await tx`update rate_limits set hits = hits + 1 where bucket = ${bucket}`;
  });
}

async function ensurePlayerPinSchema(tx: Tx) {
  await tx`alter table players add column if not exists pin_failed_attempts integer not null default 0`;
  await tx`alter table players add column if not exists pin_locked_until timestamptz`;
}

async function mergeSeen(tx: Tx, state: GameState): Promise<GameState> {

  const rows = await tx<{ id: string; last_seen_at: Date | null }[]>`
    select id, last_seen_at from players where game_id = ${state.id}
  `;
  for (const row of rows) {
    const player = state.players.find((item) => item.id === row.id);
    if (!player || !row.last_seen_at) continue;
    const seen = new Date(row.last_seen_at).toISOString();
    if (!player.lastSeenAt || seen > player.lastSeenAt) player.lastSeenAt = seen;
  }
  return state;
}

async function loadLocked(tx: Tx): Promise<GameState | null> {
  await ensurePlayerPinSchema(tx);
  const [meta] = await tx<{ current_game_id: string | null }[]>`
    select current_game_id from app_state where id = 1 for update
  `;
  if (!meta?.current_game_id) return null;
  const [row] = await tx<{ snapshot: GameState; version: number }[]>`
    select snapshot, version from games where id = ${meta.current_game_id} for update
  `;
  if (!row) return null;
  const state = row.snapshot;
  state.version = row.version;
  await overlayLibrary(tx, state);
  return mergeSeen(tx, normalizeGame(state));
}

export async function readCurrent(): Promise<GameState | null> {
  const db = sql();
  const [meta] = await db<{ current_game_id: string | null }[]>`select current_game_id from app_state where id = 1`;
  if (!meta?.current_game_id) return null;
  const [row] = await db<{ snapshot: GameState }[]>`select snapshot from games where id = ${meta.current_game_id}`;
  if (!row) return null;
  await overlayLibrary(db, row.snapshot);
  const seen = await db<{ id: string; last_seen_at: Date | null }[]>`
    select id, last_seen_at from players where game_id = ${row.snapshot.id}
  `;
  for (const item of seen) {
    const player = row.snapshot.players.find((entry) => entry.id === item.id);
    if (player && item.last_seen_at) player.lastSeenAt = new Date(item.last_seen_at).toISOString();
  }
  return normalizeGame(row.snapshot);
}

export async function markSeen(playerId: string): Promise<void> {
  await sql()`
    update players set last_seen_at = now()
    where id = ${playerId} and (last_seen_at is null or last_seen_at < now() - interval '45 seconds')
  `;
}

export async function createSession(now: number): Promise<GameState> {
  const db = sql();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const state = blankGame({ id: crypto.randomUUID(), code: roomCode(), now });
    try {
      await db.begin(async (tx) => {
        await ensurePlayerPinSchema(tx);
        await tx`
          insert into games (id, code, version, snapshot)
          values (${state.id}, ${state.code}, ${state.version}, ${asJson(tx, state)})
        `;
        await tx`update app_state set current_game_id = ${state.id} where id = 1`;
        await project(tx, state);
        await writeFeed(tx, state, now);
      });
      return state;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "23505") throw error;
    }
  }
  throw new Error("Neizdevās izveidot spēles kodu");
}

export async function mutate(action: Action, ctx: Ctx): Promise<ApplyResult> {
  const db = sql();
  return db.begin(async (tx) => {
    const current = await loadLocked(tx);
    if (!current) {
      return { state: blankGame({ id: "none", code: "-----", now: ctx.now }), appended: [], error: { code: "not_ready", message: "Spēle vēl nav izveidota." } };
    }
    const result = apply(current, action, ctx);
    if (result.error || result.ignored) return result;
    const updated = await tx`
      update games set snapshot = ${asJson(tx, result.state)}, version = ${result.state.version}, updated_at = now(),
        finished_at = case when ${result.state.phase} = 'FINISHED' then coalesce(finished_at, now()) else null end
      where id = ${current.id} and version = ${current.version}
    `;
    if (updated.count === 0) {
      return { state: current, appended: [], error: { code: "conflict", message: "Stāvoklis tikko mainījās. Mēģini vēlreiz." } };
    }
    await project(tx, result.state);
    if (action.type === "sync_videos") await saveVideos(tx, result.state);
    if (action.type === "upsert_card" || action.type === "delete_card") await saveCards(tx, result.state);
    if (result.appended.length) {
      await tx`
        insert into history ${tx(result.appended.map((entry) => ({
          id: entry.id,
          game_id: result.state.id,
          at: new Date(entry.at),
          type: entry.type,
          summary: entry.summary,
        })))}
        on conflict (id) do nothing
      `;
    }
    await writeFeed(tx, result.state, ctx.now);
    return result;
  });
}

export async function afterTick(ctx: Ctx): Promise<GameState | null> {
  const result = await mutate({ type: "tick" }, ctx);
  if (result.error?.code === "not_ready") return null;
  return result.state;
}

export async function issueTvPair(gameId: string): Promise<string> {
  const { randomToken, sha256 } = await import("@/lib/auth/crypto");
  const token = randomToken(24);
  await sql()`
    insert into tv_pair_tokens (token_hash, game_id, expires_at)
    values (${sha256(token)}, ${gameId}, now() + interval '15 minutes')
  `;
  return token;
}

export async function consumeTvPair(token: string): Promise<string | null> {
  const { sha256 } = await import("@/lib/auth/crypto");
  const hash = sha256(token);
  return sql().begin(async (tx) => {
    const [row] = await tx<{ game_id: string; expires_at: Date; used_at: Date | null }[]>`
      select game_id, expires_at, used_at from tv_pair_tokens where token_hash = ${hash} for update
    `;
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;
    await tx`update tv_pair_tokens set used_at = now() where token_hash = ${hash}`;
    return row.game_id;
  });
}

async function writeFeed(tx: Tx, state: GameState, now: number) {
  const feed = toTvState(state, now);
  await tx`
    insert into tv_feed (game_id, state, updated_at) values (${state.id}, ${asJson(tx, feed)}, now())
    on conflict (game_id) do update set state = excluded.state, updated_at = excluded.updated_at
  `;
}

async function project(tx: Tx, state: GameState) {
  await tx`delete from players where game_id = ${state.id}`;
  if (state.players.length) {
    await tx`
      insert into players ${tx(state.players.map((player) => playerRow(state.id, player)))}
    `;
  }
  await tx`delete from missions where game_id = ${state.id}`;
  if (state.missions.length) {
    await tx`
      insert into missions ${tx(state.missions.map((mission) => ({
        id: mission.id,
        game_id: state.id,
        player_id: mission.playerId,
        event_id: mission.eventId,
        card_id: mission.cardId,
        qr_token: mission.qrToken,
        title: mission.title,
        body: mission.text,
        status: mission.status,
        deadline_at: mission.deadlineAt ? new Date(mission.deadlineAt) : null,
        completed_at: mission.completedAt ? new Date(mission.completedAt) : null,
      })))}
    `;
  }
  await tx`delete from perks where game_id = ${state.id}`;
  if (state.perks.length) {
    await tx`
      insert into perks ${tx(state.perks.map((perk) => ({
        id: perk.id,
        game_id: state.id,
        player_id: perk.playerId,
        event_id: perk.eventId,
        card_id: perk.cardId,
        qr_token: perk.qrToken,
        name: perk.name,
        description: perk.description,
        status: perk.status,
        used_at: perk.usedAt ? new Date(perk.usedAt) : null,
      })))}
    `;
  }
  const events: LiveEvent[] = [];
  const seenEvents = new Set<string>();
  for (const event of [state.active, state.queue, ...state.recentEvents]) {
    if (!event || seenEvents.has(event.eventId)) continue;
    seenEvents.add(event.eventId);
    events.push(event);
  }
  await tx`delete from events where game_id = ${state.id}`;
  if (events.length) {
    await tx`
      insert into events ${tx(events.map((event) => eventRow(tx, state.id, event)))}
    `;
  }
}

async function overlayLibrary(tx: Tx | ReturnType<typeof sql>, state: GameState) {
  const videos = await tx<{
    id: string;
    public_id: string;
    folder: GameState["videos"][number]["folder"];
    filename: string;
    url: string;
    bytes: number | null;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
  }[]>`select id, public_id, folder, filename, url, bytes, width, height, duration_seconds from videos`;
  state.videos = videos.map((video) => ({
    id: video.id,
    publicId: video.public_id,
    folder: video.folder,
    filename: video.filename,
    url: video.url,
    bytes: video.bytes,
    width: video.width,
    height: video.height,
    durationSeconds: video.duration_seconds === null ? null : Number(video.duration_seconds),
  }));
  const cards = await tx<{ definition: GameState["customCards"][number] }[]>`select definition from cards`;
  state.customCards = cards.map((row) => row.definition);
}

async function saveVideos(tx: Tx, state: GameState) {
  await tx`delete from videos`;
  if (!state.videos.length) return;
  await tx`
    insert into videos ${tx(state.videos.map((video) => ({
      id: video.id,
      public_id: video.publicId,
      folder: video.folder,
      filename: video.filename,
      url: video.url,
      bytes: video.bytes,
      width: video.width,
      height: video.height,
      duration_seconds: video.durationSeconds,
    })))}
  `;
}

async function saveCards(tx: Tx, state: GameState) {
  await tx`delete from cards`;
  if (!state.customCards.length) return;
  await tx`
    insert into cards ${tx(state.customCards.map((card) => ({ id: card.id, definition: asJson(tx, card) })))}
  `;
}

function playerRow(gameId: string, player: Player) {
  return {
    id: player.id,
    game_id: gameId,
    name: player.name,
    public_name: player.publicName,
    session_hash: player.sessionHash,
    recovery_hash: player.pinHash,
    pin_failed_attempts: player.pinFailedAttempts,
    pin_locked_until: player.pinLockedUntil ? new Date(player.pinLockedUntil) : null,
    call_count: player.callCount,
    eligible: player.eligible,
    removed: player.removed,
    last_seen_at: player.lastSeenAt ? new Date(player.lastSeenAt) : null,
    created_at: new Date(player.createdAt),
  };
}

function eventRow(tx: Tx, gameId: string, event: LiveEvent) {
  const { publicTitle, publicLines, playerName, extraPlayers, choice, outcome, status } = event;
  return {
    id: event.eventId,
    game_id: gameId,
    status,
    player_id: event.playerId,
    card_id: event.cardId,
    category: event.category,
    qr_token: event.qrToken,
    qr_expires_at: event.qrExpiresAt ? new Date(event.qrExpiresAt) : null,
    private_payload: asJson(tx, { playerName, extraPlayers, choice, outcome, callVideoLevel: event.callVideoLevel }),
    public_payload: asJson(tx, {
      publicTitle,
      publicLines,
      playerName: status === "qr" || status === "active" || status === "claimed" ? playerName : null,
      tvHold: Boolean(event.tvHold),
    }),
  };
}
