import { after } from "next/server";
import postgres from "postgres";
import { serverEnv } from "@/lib/server/env";

export type Sql = ReturnType<typeof postgres>;
export type Tx = postgres.TransactionSql<Record<string, never>>;

const POOLER_PORT = 6543;
/**
 * OpenNext stores the current request on this symbol (AsyncLocalStorage).
 * A new object is created for each request, so a WeakMap keyed by it cannot
 * hand a TCP socket to the next request. Workers forbid that reuse.
 */
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

type RequestScope = object;

let nodeClient: Sql | null = null;
const workerClients = new WeakMap<object, Sql>();

function isCloudflareWorker(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export function databaseConfigured(): boolean {
  return Boolean(hyperdriveUrl() || serverEnv("DATABASE_URL"));
}

/**
 * Cloudflare Hyperdrive binding (`HYPERDRIVE` in wrangler.jsonc).
 * Workers cannot verify Supabase's TLS certificate directly (postgres.js then
 * reconnects until "Too many subrequests"). Hyperdrive does TLS to Supabase
 * itself, and the Worker talks to Hyperdrive without client SSL.
 */
function hyperdriveUrl(): string | null {
  const scope = (globalThis as Record<symbol, unknown>)[CLOUDFLARE_CONTEXT] as
    | { env?: { HYPERDRIVE?: { connectionString?: unknown } } }
    | undefined;
  const value = scope?.env?.HYPERDRIVE?.connectionString;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function sql(): Sql {
  if (isCloudflareWorker()) return workerSql();
  nodeClient ??= open(nodeOptions());
  return nodeClient;
}

function workerSql(): Sql {
  const scope = requestScope();
  if (scope) {
    const existing = workerClients.get(scope);
    if (existing) return existing;
  }
  const hyperdrive = hyperdriveUrl();
  const client = hyperdrive
    ? postgres(hyperdrive, { ...workerOptions(), ssl: false })
    : open(workerOptions());
  if (scope) workerClients.set(scope, client);
  closeAfterResponse(client);
  return client;
}

function requestScope(): RequestScope | null {
  const value = (globalThis as Record<symbol, unknown>)[CLOUDFLARE_CONTEXT];
  if (!value || typeof value !== "object") return null;
  return value as RequestScope;
}

function closeAfterResponse(client: Sql) {
  try {
    // `after` runs once the response is done. Calling `end()` here would close
    // the socket before the request's queries finish.
    after(() => client.end({ timeout: 5 }));
  } catch {
    // Outside a request the client is not stored, so the socket is not reused.
  }
}

function open(options: postgres.Options<Record<string, postgres.PostgresType>>): Sql {
  return postgres(databaseUrl(), options);
}

function databaseUrl(): string {
  const url = serverEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL nav iestatīts");
  if (serverEnv("DATABASE_SSL") === "disable") return url;
  if (portOf(url) !== POOLER_PORT) {
    throw new Error("DATABASE_URL jābūt Supabase transaction pooler portam 6543");
  }
  return url;
}

function portOf(url: string): number | null {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol.startsWith("postgres") ? 5432 : null;
  } catch {
    const at = url.lastIndexOf("@");
    const host = at >= 0 ? url.slice(at + 1) : url;
    const match = host.match(/:(\d+)(?:\/|$)/);
    return match ? Number(match[1]) : null;
  }
}

function sslMode(): "require" | false {
  return serverEnv("DATABASE_SSL") === "disable" ? false : "require";
}

function workerOptions(): postgres.Options<Record<string, postgres.PostgresType>> {
  return {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    ssl: sslMode(),
    fetch_types: false,
  };
}

function nodeOptions(): postgres.Options<Record<string, postgres.PostgresType>> {
  return {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: sslMode(),
  };
}
