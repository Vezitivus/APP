import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL nav iestatīts");
  if (!client) {
    client = postgres(url, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
    });
  }
  return client;
}

export type Tx = postgres.TransactionSql<Record<string, never>>;
