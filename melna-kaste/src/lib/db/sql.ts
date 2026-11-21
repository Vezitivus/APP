import { after } from "next/server";
import postgres from "postgres";
import { serverEnv } from "@/lib/server/env";

export type Sql = ReturnType<typeof postgres>;
export type Tx = postgres.TransactionSql<Record<string, never>>;

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
  return Boolean(serverEnv("DATABASE_URL") || hyperdriveUrl());
}

/** Used only when DATABASE_URL is not set. */
function hyperdriveUrl(): string | null {
  const scope = (globalThis as Record<symbol, unknown>)[CLOUDFLARE_CONTEXT] as
    | { env?: { HYPERDRIVE?: { connectionString?: unknown } } }
    | undefined;
  const value = scope?.env?.HYPERDRIVE?.connectionString;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function sql(): Sql {
  if (isCloudflareWorker()) return workerSql();
  nodeClient ??= open(databaseUrl(), nodeOptions());
  return nodeClient;
}

function workerSql(): Sql {
  const scope = requestScope();
  if (scope) {
    const existing = workerClients.get(scope);
    if (existing) return existing;
  }
  const direct = serverEnv("DATABASE_URL");
  const client = direct
    ? open(direct, workerOptions())
    : open(requireHyperdrive(), { ...workerOptions(), ssl: false });
  if (scope) workerClients.set(scope, client);
  closeAfterResponse(client);
  return client;
}

function requireHyperdrive(): string {
  const url = hyperdriveUrl();
  if (!url) throw new Error("DATABASE_URL nav iestatīts");
  return url;
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

function open(url: string, options: postgres.Options<Record<string, postgres.PostgresType>>): Sql {
  return postgres(url, options);
}

function databaseUrl(): string {
  const url = serverEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL nav iestatīts");
  return url;
}

function sslMode(): "require" | false {
  if (serverEnv("DATABASE_SSL") === "disable") return false;
  return "require";
}

function workerOptions(): postgres.Options<Record<string, postgres.PostgresType>> {
  // Workers always verify TLS and do not trust the Supabase private CA.
  // rejectUnauthorized is not implemented, so ssl:true retries until
  // "Too many subrequests". Plain TCP works on the Supabase pooler; Hyperdrive
  // already used ssl:false (encrypted only on the Hyperdrive-to-origin hop).
  return {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 8,
    ssl: false,
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
