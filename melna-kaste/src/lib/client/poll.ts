"use client";

import { useCallback, useEffect, useState } from "react";

/** Backup intervals when the tab is visible. Hidden tabs do not poll. Realtime (tv_feed) reloads immediately. */
export const POLL_MS = {
  tvStandby: 15_000,
  tvActive: 5_000,
  admin: 10_000,
  player: 25_000,
  videos: 30_000,
} as const;

export function playerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mk_player_token");
}

export function savePlayerToken(token: string) {
  localStorage.setItem("mk_player_token", token);
}

export async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body) headers.set("content-type", "application/json");
  const token = playerToken();
  if (token) headers.set("x-player-token", token);
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, body };
}

export function usePoll<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const reload = useCallback(async () => {
    try {
      const result = await api<T & { error?: { message?: string } }>(url);
      setStatus(result.status);
      if (result.status >= 400) setError(result.body.error?.message ?? "Kļūda");
      else {
        setError(null);
        setData(result.body);
      }
    } catch {
      setError("Nav savienojuma. Mēģinu vēlreiz.");
    }
  }, [url]);

  useEffect(() => {
    let stopped = false;
    const run = () => {
      if (!stopped && !document.hidden) void reload();
    };
    void reload();
    const id = window.setInterval(run, intervalMs);
    window.addEventListener("online", run);
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, intervalMs]);

  return { data, error, status, reload, setData };
}

/** Reload when the shared tv_feed row changes (Supabase Realtime, free plan). */
export function useFeedReload(reload: () => void) {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;
    void import("@supabase/supabase-js").then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient(url, key);
      channel = client
        .channel(`melna-kaste-feed-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tv_feed" }, () => reload())
        .subscribe();
    });
    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
  }, [reload]);
}

export function useClock(serverNow?: string | null) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (serverNow) setOffset(Date.parse(serverNow) - Date.now());
  }, [serverNow]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return now + offset;
}
