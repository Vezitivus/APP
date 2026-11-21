"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { TvState } from "@/lib/game/project";
import { api, usePoll } from "@/lib/client/poll";
import { nextBufferUrls, nextPlayUrl } from "@/lib/tv/playback";
import { TvPicture } from "@/components/tv-picture";

function playingUrl(game: TvState | null): string | null {
  const playback = game?.playback;
  if (!playback) return null;
  if (playback.mode === "standby") return playback.clipUrl;
  if (playback.mode === "announcement" || playback.mode === "intro" || playback.mode === "outro" || playback.mode === "hold") return playback.announcementUrl;
  return null;
}

export function TvScreen({ invalidPair }: { invalidPair: boolean }) {
  const poll = usePoll<{ paired: boolean; game: TvState | null; serverNow: string }>("/api/tv/state", 1500);
  const [game, setGame] = useState<TvState | null>(null);
  const [armed, setArmed] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [pairToken, setPairToken] = useState("");
  const [pairError, setPairError] = useState(invalidPair ? "TV saite vairs nav derīga. Izveido jaunu režijā." : "");
  const version = useRef(0);

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
    try { await document.documentElement.requestFullscreen(); } catch { /* pārlūks var liegt pilnekrānu */ }
    sessionStorage.setItem("mk_tv_armed", "1");
    setArmed(true);
    setSoundError(false);
  }

  const paired = Boolean(poll.data?.paired);
  const screen = game?.screen;
  const hold = screen?.kind === "call";
  const bleed = screen?.kind === "standby";
  const placeholder = screen?.kind === "call" && !screen.videoUrl;
  const showSound = Boolean(
    paired && armed && soundError && screen && screen.kind !== "standby" && screen.kind !== "static" && screen.kind !== "call",
  );

  return (
    <main className="tv">
      <div className={`picture${hold ? " hold" : ""}${bleed ? " bleed" : ""}${placeholder ? " placeholder" : ""}`}>
        {game && playback ? (
          <TvPicture
            url={playingUrl(game)}
            nextUrl={nextPlayUrl(playback.nextUrl)}
            preloadUrls={nextBufferUrls({
              nextUrl: playback.nextUrl,
              nextNextUrl: playback.nextNextUrl,
              preloadCallUrl: game.preloadCallUrl,
              openVideoUrl: game.openVideoUrl,
              endVideoUrl: game.endVideoUrl,
            })}
            loop={playback.mode === "hold"}
            muted={!armed || playback.mode === "hold" || (playback.mode === "standby" && game.standbyMuted)}
            cycleId={playback.cycleId}
            clipToken={playback.clipToken}
            armed={armed}
            onEnded={(cycleId, clipToken) => void report("ended", cycleId, clipToken)}
            onFailed={(cycleId, clipToken) => void report("failed", cycleId, clipToken)}
            onPlayBlocked={() => {
              if (playback.mode === "standby" || playback.mode === "hold") return;
              setSoundError(true);
              void api("/api/tv/playback", { method: "POST", body: JSON.stringify({ type: "audio", blocked: true }) });
            }}
          />
        ) : null}
        {placeholder ? (
          <div className="portrait" aria-hidden="true">
            <span>M</span>
          </div>
        ) : null}
      </div>
      {paired && armed && game ? <Stage game={game} /> : null}
      {paired && armed && game?.joinOpen && (game.screen.kind === "standby" || game.screen.kind === "static") ? <JoinBar game={game} /> : null}
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
          <div className="gate-box frame">
            <p className="kicker">Melnā kaste</p>
            <h1>Aktivizēt ekrānu</h1>
            <p className="quiet">Viena pieskare ieslēdz skaņu un, ja pārlūks atļauj, pilnekrānu.</p>
            <button className="btn" type="button" onClick={() => void arm()}>Aktivizēt TV</button>
            {soundError ? <p className="warn">Pārlūks bloķē skaņu, kamēr tā nav aktivizēta.</p> : null}
          </div>
        </div>
      ) : null}
      {showSound ? (
        <button className="btn sound" type="button" onClick={() => void arm()}>
          Ieslēgt skaņu
        </button>
      ) : null}
      {poll.error && !game ? <div className="overlay"><p>{poll.error}</p></div> : null}
    </main>
  );
}

function Stage({ game }: { game: TvState }) {
  const screen = game.screen;
  if (screen.kind === "lobby") return null;
  if (screen.kind === "call") return <CallHold name={screen.name} title={screen.title} path={screen.qrPath} />;
  if (screen.kind === "claimed") {
    return (
      <div className="center">
        <div className="event-card">
          <p className="kicker">Kartīte</p>
          <h1 className="name">{screen.name}</h1>
        </div>
      </div>
    );
  }
  if (screen.kind === "event") {
    return (
      <div className="center">
        <div className="event-card">
          <p className="kicker">Visiem</p>
          <h1 className="name">{screen.title}</h1>
          {screen.names.length ? <p className="lines">{screen.names.join("  ·  ")}</p> : null}
          {screen.lines.map((line) => <p className="lines" key={line}>{line}</p>)}
        </div>
      </div>
    );
  }
  if (screen.kind === "finished") {
    if (game.playback.mode === "outro") return null;
    return <Finale />;
  }
  return null;
}

function JoinBar({ game }: { game: TvState }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}${game.joinPath}`;
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 640,
      errorCorrectionLevel: "H",
      color: { dark: "#1a140c", light: "#f6f0e4" },
    }).then(setSrc);
  }, [game.joinPath]);
  const names = game.playerNames;
  const label = names.length === 0
    ? "Vēl neviens nav iekšā"
    : names.length === 1
      ? "1 dalībnieks"
      : `${names.length} dalībnieki`;
  return (
    <div className="join-bar">
      {src ? (
        <div className="qr-frame">
          <img className="qr" alt="Pievienošanās QR kods" src={src} />
        </div>
      ) : null}
      <div className="join-copy">
        <p className="kicker">Pievienojies</p>
        <p className="join-title">Skenē un ieraksti savu vārdu</p>
        <p className="quiet">{label}{names.length ? ` · ${names.join("  ·  ")}` : ""}</p>
      </div>
    </div>
  );
}

function CallHold({ name, title, path }: { name: string; title: string; path: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(`${window.location.origin}${path}`, {
      margin: 1,
      width: 1000,
      errorCorrectionLevel: "H",
      color: { dark: "#1a140c", light: "#f6f0e4" },
    }).then(setSrc);
  }, [path]);
  return (
    <div className="call-banner">
      <p className="kicker">Izsaukums</p>
      <h1 className="name">{name}</h1>
      {title ? <p className="task">{title}</p> : null}
      {src ? (
        <div className="qr-frame">
          <img className="qr" alt={`QR kods, ${name}`} src={src} />
        </div>
      ) : null}
    </div>
  );
}

function Finale() {
  return (
    <div className="center">
      <div className="event-card">
        <p className="kicker">Melnā kaste</p>
        <h1 className="name">Līdz nākamajai reizei</h1>
      </div>
    </div>
  );
}
