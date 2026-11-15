"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { TvState } from "@/lib/game/project";
import { api, useClock, usePoll } from "@/lib/client/poll";

export function TvScreen({ invalidPair }: { invalidPair: boolean }) {
  const poll = usePoll<{ paired: boolean; game: TvState | null; serverNow: string }>("/api/tv/state", 1500);
  const [game, setGame] = useState<TvState | null>(null);
  const [armed, setArmed] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [pairToken, setPairToken] = useState("");
  const [pairError, setPairError] = useState(invalidPair ? "TV saite vairs nav derīga. Izveido jaunu režijā." : "");
  const version = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadRef = useRef<HTMLVideoElement>(null);
  const tokenRef = useRef<string | null>(null);
  const fails = useRef(0);

  useEffect(() => {
    const incoming = poll.data?.game;
    if (!incoming || incoming.version < version.current) return;
    version.current = incoming.version;
    setGame(incoming);
  }, [poll.data]);

  useEffect(() => {
    setArmed(sessionStorage.getItem("mk_tv_armed") === "1");
  }, []);

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
        .channel("melna-kaste-tv")
        .on("postgres_changes", { event: "*", schema: "public", table: "tv_feed" }, () => poll.reload())
        .subscribe();
    });
    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
  }, [poll.reload]);

  const playback = game?.playback;
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !playback || !game) return;
    const mode = playback.mode;
    const url = mode === "standby" ? playback.clipUrl : mode === "announcement" || mode === "intro" ? playback.announcementUrl : null;
    element.muted = mode === "standby" ? game.standbyMuted : false;
    if (!url) {
      if (element.getAttribute("src")) {
        element.removeAttribute("src");
        element.load();
      }
      tokenRef.current = playback.clipToken;
      return;
    }
    if (tokenRef.current === playback.clipToken) return;
    tokenRef.current = playback.clipToken;
    fails.current = 0;
    element.dataset.cycle = playback.cycleId;
    element.dataset.token = playback.clipToken;
    element.src = url;
    const pending = element.play();
    pending?.catch(() => {
      if (mode === "standby") return;
      setSoundError(true);
      void api("/api/tv/playback", { method: "POST", body: JSON.stringify({ type: "audio", blocked: true }) });
    });
  }, [playback, game]);

  useEffect(() => {
    const element = preloadRef.current;
    if (!element || !game || !playback) return;
    const url = game.preloadCallUrl || playback.nextUrl;
    if (url && element.getAttribute("src") !== url) element.src = url;
  }, [game, playback]);

  async function report(type: "ended" | "failed", cycleId: string, clipToken: string) {
    if (!cycleId || !clipToken) return;
    const result = await api<{ game?: TvState }>("/api/tv/playback", {
      method: "POST",
      body: JSON.stringify({ type, cycleId, clipToken }),
    });
    if (result.body.game && result.body.game.version >= version.current) {
      version.current = result.body.game.version;
      setGame(result.body.game);
    }
  }

  async function pair(event: React.FormEvent) {
    event.preventDefault();
    const token = pairToken.trim().split("pair=").pop()?.trim() ?? "";
    const result = await api<{ error?: { message?: string } }>("/api/tv/pair", { method: "POST", body: JSON.stringify({ token }) });
    if (result.status >= 400) setPairError(result.body.error?.message ?? "Neizdevās savienot.");
    else window.location.href = "/tv";
  }

  async function arm() {
    const element = videoRef.current;
    if (element) {
      element.muted = true;
      try {
        await element.play();
        element.pause();
      } catch {
        setSoundError(true);
      }
    }
    try { await document.documentElement.requestFullscreen(); } catch { /* pārlūks var liegt pilnekrānu */ }
    sessionStorage.setItem("mk_tv_armed", "1");
    setArmed(true);
    setSoundError(false);
  }

  const paired = Boolean(poll.data?.paired);
  const clock = useClock(game?.serverNow ?? poll.data?.serverNow);

  return (
    <main className="tv">
      <video
        ref={videoRef}
        className="show"
        playsInline
        preload="auto"
        onEnded={(event) => void report("ended", event.currentTarget.dataset.cycle ?? "", event.currentTarget.dataset.token ?? "")}
        onError={(event) => {
          fails.current += 1;
          const element = event.currentTarget;
          if (fails.current < 3) {
            element.load();
            void element.play().catch(() => undefined);
            return;
          }
          fails.current = 0;
          void report("failed", element.dataset.cycle ?? "", element.dataset.token ?? "");
        }}
      />
      <video ref={preloadRef} className="preload" preload="auto" muted playsInline />
      {paired && armed && game ? <Stage game={game} now={clock} /> : null}
      {!paired ? (
        <form className="overlay" onSubmit={pair}>
          <div className="gate-box frame">
            <p className="kicker">TV</p>
            <h1>Savieno ekrānu</h1>
            <p className="quiet">Atver TV saiti no režijas vai ielīmē to šeit. Pēc savienošanas video vadīs tikai šis ekrāns.</p>
            <input value={pairToken} onChange={(event) => setPairToken(event.target.value)} placeholder="TV saite" aria-label="TV saite" />
            {pairError ? <p className="warn">{pairError}</p> : null}
            <button className="btn" type="submit">Savienot</button>
          </div>
        </form>
      ) : null}
      {paired && !armed ? (
        <div className="overlay">
          <div className="gate-box">
            <div className="box" />
            <p className="kicker">Melnā kaste</p>
            <button className="btn" type="button" onClick={() => void arm()}>Aktivizēt TV</button>
            {soundError ? <p className="warn">Pārlūks bloķē skaņu, kamēr tā nav aktivizēta.</p> : null}
          </div>
        </div>
      ) : null}
      {paired && armed && soundError ? (
        <button className="btn" style={{ position: "absolute", bottom: 24, right: 24 }} type="button" onClick={() => void arm()}>
          Ieslēgt skaņu
        </button>
      ) : null}
      {poll.error && !game ? <div className="overlay"><p>{poll.error}</p></div> : null}
    </main>
  );
}

function Stage({ game, now }: { game: TvState; now: number }) {
  const screen = game.screen;
  if (screen.kind === "lobby") return <Lobby game={game} />;
  if (screen.kind === "qr") return <Call name={screen.name} path={screen.qrPath} expiresAt={screen.expiresAt} now={now} />;
  if (screen.kind === "claimed") return <div className="center"><h1 className="name">{screen.name}</h1></div>;
  if (screen.kind === "event") {
    return (
      <div className="center">
        <h1 className="name">{screen.title}</h1>
        {screen.names.length ? <p className="lines">{screen.names.join("  ·  ")}</p> : null}
        {screen.lines.map((line) => <p className="lines" key={line}>{line}</p>)}
      </div>
    );
  }
  if (screen.kind === "finished") return <Finale url={game.endVideoUrl} />;
  if (screen.kind === "static" || game.playback.total === 0) {
    return <div className="center"><div className="box" /><p className="kicker">Melnā kaste</p></div>;
  }
  return null;
}

function Lobby({ game }: { game: TvState }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/join?code=${game.code}`;
    void QRCode.toDataURL(url, { margin: 1, width: 800, color: { dark: "#16140f", light: "#f4efe4" } }).then(setSrc);
  }, [game.code]);
  return (
    <div className="center">
      <p className="kicker">Pievienojies</p>
      {src ? <img className="qr" alt="Pievienošanās QR kods" src={src} /> : null}
      <p className="count">{game.code}</p>
      <p className="quiet">{game.playerCount} jau iekšā</p>
    </div>
  );
}

function Call({ name, path, expiresAt, now }: { name: string; path: string; expiresAt: string; now: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(`${window.location.origin}${path}`, { margin: 1, width: 800, color: { dark: "#16140f", light: "#f4efe4" } }).then(setSrc);
  }, [path]);
  const left = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return (
    <div className="center">
      <h1 className="name">{name}</h1>
      {src ? <img className="qr" alt="Kartītes QR kods" src={src} /> : null}
      <p className="count">{left}</p>
    </div>
  );
}

function Finale({ url }: { url: string | null }) {
  const played = useRef(false);
  const ref = useRef<HTMLVideoElement>(null);
  const [done, setDone] = useState(!url);
  useEffect(() => {
    if (!url || played.current) return;
    played.current = true;
    const element = ref.current;
    if (!element) return;
    element.src = url;
    void element.play().catch(() => setDone(true));
  }, [url]);
  if (!done) return <video ref={ref} className="show" playsInline onEnded={() => setDone(true)} />;
  return <div className="center"><div className="box" /><h1 className="name">Līdz nākamajai reizei</h1></div>;
}
