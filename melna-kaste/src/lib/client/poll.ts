"use client";

import { useCallback, useEffect, useState } from "react";

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
    const run = () => { if (!stopped) void reload(); };
    run();
    const id = window.setInterval(run, intervalMs);
    window.addEventListener("online", run);
    const onVisible = () => { if (!document.hidden) run(); };
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
