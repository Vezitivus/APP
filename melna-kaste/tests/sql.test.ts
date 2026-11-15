import { afterEach, describe, expect, it, vi } from "vitest";

const postgres = vi.hoisted(() =>
  vi.fn(() => ({
    end: vi.fn(async () => undefined),
  })),
);

const after = vi.hoisted(() => vi.fn());

vi.mock("postgres", () => ({ default: postgres }));
vi.mock("next/server", () => ({ after }));

const POOLER = "postgresql://postgres.project:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
const DIRECT = "postgresql://postgres.project:secret@db.project.supabase.co:5432/postgres";
const CONTEXT = Symbol.for("__cloudflare-context__");

const originalNavigator = globalThis.navigator;

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_SSL;
  Reflect.deleteProperty(globalThis, CONTEXT);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  });
  vi.resetModules();
  postgres.mockClear();
  after.mockClear();
});

async function loadSql() {
  return import("../src/lib/db/sql");
}

function asWorker() {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "Cloudflare-Workers" },
  });
}

describe("postgres klients", () => {
  it("uz Node koplieto vienu savienojumu un prasa transaction pooler", async () => {
    process.env.DATABASE_URL = POOLER;
    const { sql } = await loadSql();
    const first = sql();
    const second = sql();
    expect(first).toBe(second);
    expect(postgres).toHaveBeenCalledTimes(1);
    expect(postgres).toHaveBeenCalledWith(
      POOLER,
      expect.objectContaining({ prepare: false, ssl: "require", max: 3 }),
    );
    expect(after).not.toHaveBeenCalled();
  });

  it("uz Node lokālam Postgres bez SSL atļauj citu portu", async () => {
    process.env.DATABASE_URL = "postgresql://app:secret@127.0.0.1:5432/melna";
    process.env.DATABASE_SSL = "disable";
    const { sql } = await loadSql();
    sql();
    expect(postgres).toHaveBeenCalledWith(
      process.env.DATABASE_URL,
      expect.objectContaining({ prepare: false, ssl: false }),
    );
  });

  it("uz Worker katram pieprasījumam ir savs klients un ssl require", async () => {
    asWorker();
    process.env.DATABASE_URL = POOLER;
    const scopes: object[] = [];
    Object.defineProperty(globalThis, CONTEXT, {
      configurable: true,
      get: () => scopes[0],
    });
    const { sql } = await loadSql();
    scopes.push({ id: "a" });
    const first = sql();
    const again = sql();
    scopes[0] = { id: "b" };
    const second = sql();
    expect(first).toBe(again);
    expect(second).not.toBe(first);
    expect(postgres).toHaveBeenCalledTimes(2);
    expect(postgres).toHaveBeenCalledWith(
      POOLER,
      expect.objectContaining({ prepare: false, ssl: "require", max: 1, fetch_types: false }),
    );
    expect(after).toHaveBeenCalledTimes(2);
    const close = after.mock.calls[0]?.[0] as () => Promise<void>;
    expect(first.end).not.toHaveBeenCalled();
    await close();
    expect(first.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it("uz Worker bez pieprasījuma konteksta nekoplieto moduli", async () => {
    asWorker();
    process.env.DATABASE_URL = POOLER;
    const { sql } = await loadSql();
    expect(sql()).not.toBe(sql());
    expect(postgres).toHaveBeenCalledTimes(2);
  });

  it("uz Worker atraida tiešo 5432 adresi un neizpauž paroli", async () => {
    asWorker();
    process.env.DATABASE_URL = DIRECT;
    const { sql } = await loadSql();
    expect(() => sql()).toThrow(/6543/);
    try {
      sql();
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
    expect(postgres).not.toHaveBeenCalled();
  });
});
