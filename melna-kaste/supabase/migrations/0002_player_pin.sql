-- Player-chosen 4-digit PINs. The hash stays in players.recovery_hash, but the
-- stored value becomes a salted PBKDF2-SHA-256 string (pbkdf2$sha256$...).
-- Old sha256 recovery codes stop working; the host can set a new PIN in /admin.
-- Authoritative game state is games.snapshot; this also rewrites player objects
-- there. Safe to run more than once. The Worker also applies the new columns on first write
-- (via Hyperdrive) if this file has not yet been run in the SQL editor.

alter table players add column if not exists pin_failed_attempts integer not null default 0;
alter table players add column if not exists pin_locked_until timestamptz;

update games
set snapshot = jsonb_set(
  snapshot,
  '{players}',
  (
    select coalesce(jsonb_agg(normalized order by ordinality), '[]'::jsonb)
    from jsonb_array_elements(coalesce(snapshot->'players', '[]'::jsonb))
      with ordinality as t(player, ordinality)
    cross join lateral (
      select (player - 'recoveryHash') || jsonb_build_object(
        'pinHash', coalesce(player->>'pinHash', player->>'recoveryHash', ''),
        'pinFailedAttempts', coalesce((player->>'pinFailedAttempts')::int, 0),
        'pinLockedUntil', case
          when player ? 'pinLockedUntil' then player->'pinLockedUntil'
          else 'null'::jsonb
        end
      ) as normalized
    ) n
  )
)
where snapshot ? 'players';
