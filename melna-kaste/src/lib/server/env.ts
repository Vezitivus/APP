/**
 * Read a server variable when the function runs.
 * Computed access is left as a runtime lookup. Next.js only inlines
 * `process.env.NEXT_PUBLIC_*` (and keys listed in `next.config` `env`).
 * On Workers, `nodejs_compat` fills `process.env` from vars and secrets.
 */
export function serverEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
