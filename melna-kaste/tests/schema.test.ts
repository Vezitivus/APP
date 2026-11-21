import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url), "utf8");
const pinSql = readFileSync(new URL("../supabase/migrations/0002_player_pin.sql", import.meta.url), "utf8");

describe("datubāzes shēma", () => {
  const tables = ["app_state", "games", "players", "events", "missions", "perks", "videos", "cards", "history", "rate_limits", "tv_pair_tokens", "tv_feed"];

  it("katrai tabulai ieslēdz rindas līmeņa drošību un atņem anon piekļuvi", () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain("revoke all on table %I from anon, authenticated");
  });

  it("publiski lasāma ir tikai TV plūsma", () => {
    expect(sql).toContain("grant select on table tv_feed to anon, authenticated");
    expect(sql.match(/grant select on table/g)).toHaveLength(1);
    expect(sql).toContain("create policy tv_feed_public_read");
  });

  it("PIN migrācija pievieno bloķēšanas laukus un pārceļ snapshot hash", () => {
    expect(pinSql).toContain("pin_failed_attempts");
    expect(pinSql).toContain("pin_locked_until");
    expect(pinSql).toContain("pinHash");
    expect(pinSql).toContain("recoveryHash");
    expect(pinSql).toContain("add column if not exists");
  });
});
