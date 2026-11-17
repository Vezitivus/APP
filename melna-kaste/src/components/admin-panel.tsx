"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminState } from "@/lib/game/project";
import { AUTO_CATEGORIES } from "@/lib/game/types";
import { api, useClock, usePoll } from "@/lib/client/poll";

const PHASES: Record<string, string> = {
  LOBBY: "Uzgaidāmā telpa",
  STANDBY: "Standby",
  QUEUED: "Rindā",
  ANNOUNCEMENT: "Izsaukuma video",
  QR_WAITING: "QR skenēšana",
  CARD_CLAIMED: "Kartīte atvērta",
  ACTIVE_EVENT: "Aktīvs notikums",
  FINISHED: "Pabeigta",
};

export function AdminPanel() {
  const poll = usePoll<{ game: AdminState | null }>("/api/admin/state", 2000);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [tvUrl, setTvUrl] = useState("");
  const [codes, setCodes] = useState<{ name: string; recoveryCode: string }[]>([]);
  const [resetArmed, setResetArmed] = useState(false);
  const game = poll.data?.game ?? null;
  const clock = useClock(game?.serverNow);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key.toLowerCase() === "n") void send({ type: "accelerate" });
      if (event.key.toLowerCase() === "s") void send({ type: "skip" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(body: object) {
    const result = await api<{ error?: { message?: string }; tvUrl?: string; testPlayers?: { name: string; recoveryCode: string }[]; recoveryCode?: string }>(
      "/api/admin/action",
      { method: "POST", body: JSON.stringify(body) },
    );
    if (result.status === 401) return;
    if (result.status >= 400) setMessage(result.body.error?.message ?? "Neizdevās");
    else {
      setMessage("");
      if (result.body.tvUrl) setTvUrl(result.body.tvUrl);
      if (result.body.testPlayers) setCodes(result.body.testPlayers);
      if (result.body.recoveryCode) setMessage(`Jaunais atjaunošanas kods: ${result.body.recoveryCode}`);
    }
    await poll.reload();
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const result = await api<{ error?: { message?: string } }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (result.status >= 400) setMessage(result.body.error?.message ?? "Neizdevās pieteikties");
    else {
      setMessage("");
      setPassword("");
      await poll.reload();
    }
  }

  if (poll.status === null && !poll.error) return <main className="home"><p className="kicker">Melnā kaste</p></main>;

  if (poll.status === 401 || poll.status === 503) {
    return (
      <main className="home">
        <form className="frame" onSubmit={login}>
          <p className="kicker">Režija</p>
          <h1>Melnā kaste</h1>
          <label>Parole<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {message ? <p className="warn">{message}</p> : null}
          <button className="btn" type="submit">Ieiet</button>
        </form>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="home">
        <section className="frame">
          <p className="kicker">Režija</p>
          <h1>Jauna spēle</h1>
          <p className="lede">Iepriekšējās spēles paliek datubāzē. Šī poga izveido jaunu sesiju.</p>
          <button className="btn" type="button" onClick={() => void send({ type: "create_game" })}>Izveidot spēli</button>
          {tvUrl ? <p><a href={tvUrl}>Atvērt TV</a></p> : null}
          {message ? <p className="warn">{message}</p> : null}
        </section>
      </main>
    );
  }

  const seconds = game.nextAutoAt ? Math.max(0, Math.round((Date.parse(game.nextAutoAt) - clock) / 1000)) : null;

  return (
    <main className="sheet">
      <div className="panel">
        <header className="status">
          <div>
            <p className="kicker">Režija · {game.code}</p>
            <h1 className="phase">{PHASES[game.phase] ?? game.phase}</h1>
            <div className="row">
              {game.paused ? <span className="pill">Pauze</span> : null}
              <span className="pill">{game.autoCalls ? "Auto ieslēgts" : "Auto izslēgts"}</span>
              <span className="pill">{game.players.filter((player) => !player.removed).length} dalībnieki</span>
            </div>
          </div>
          <div className="row">
            <Link href="/admin/videos">Video</Link>
            <button className="btn-ghost" type="button" onClick={() => void send({ type: "create_game" })}>Jauna spēle</button>
            <button className="btn-ghost" type="button" onClick={() => void api("/api/admin/logout", { method: "POST" }).then(() => poll.reload())}>Iziet</button>
          </div>
        </header>
        {message ? <p className="warn">{message}</p> : null}
        {tvUrl ? <p>TV saite: <a href={tvUrl}>{tvUrl}</a></p> : <p className="quiet">Jaunu TV saiti iegūsi, sākot spēli vai izveidojot jaunu.</p>}

        {game.active?.tvHold ? (
          <section className="continue-banner">
            <p className="kicker">TV</p>
            <h2>Izsaukums ekrānā</h2>
            <p>{game.active.playerName ?? "Dalībnieks"} — {game.active.cardTitle}</p>
            <button className="btn continue" type="button" onClick={() => void send({ type: "continue_tv" })}>Turpināt</button>
            <p className="quiet">Ekrāns paliek, kamēr nospied. Pēc tam TV rāda tikai standby no pirmā video. Ja kartīte jau ir atvērta, uzdevums telefonā paliek.</p>
          </section>
        ) : null}

        <section className="card">
          <h2>Slepenā režija</h2>
          <div className="director">
            <button className="btn" type="button" onClick={() => void send({ type: "accelerate" })}>Paātrināt</button>
            <button className="btn-ghost" type="button" onClick={() => void send({ type: "skip" })}>Izlaist</button>
            <Swap players={game.players} onSwap={(playerId) => void send({ type: "swap_player", playerId })} />
          </div>
          <p className="quiet">Paātrināt sagatavo nākamo notikumu, negaidot intervālu. Izlaist noņem notikumu, un TV to nepaskaidro. TV izsaukums pats nepazūd — to aizver Turpināt. Taustiņi N un S.</p>
        </section>

        <section className="card">
          <h2>Vadība</h2>
          <div className="row">
            <button className="btn" type="button" onClick={() => void send({ type: "start" })} disabled={game.phase !== "LOBBY"}>Sākt</button>
            <button className="btn-ghost" type="button" onClick={() => void send({ type: game.paused ? "resume" : "pause" })}>{game.paused ? "Atsākt auto" : "Apturēt auto"}</button>
            <button className="btn-ghost" type="button" onClick={() => void send({ type: "set_auto", enabled: !game.autoCalls })}>{game.autoCalls ? "Izslēgt auto" : "Ieslēgt auto"}</button>
            <button className="btn-ghost" type="button" onClick={() => void send({ type: "finish" })}>Pabeigt</button>
            <button className="btn-danger" type="button" onClick={() => resetArmed ? void send({ type: "reset", confirm: true }).then(() => setResetArmed(false)) : setResetArmed(true)}>
              {resetArmed ? "Apstiprināt atiestatīšanu" : "Atiestatīt"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Šobrīd</h2>
          <p>Video: {game.playback.current ?? "nav"} · {game.playback.total ? `${game.playback.index + 1}/${game.playback.total}` : "melns ekrāns"} · nākamais {game.playback.next ?? "—"}</p>
          <p>{game.queue ? `Rindā: ${game.queue.playerName ?? "visi"} — ${game.queue.cardTitle} (${game.queue.videoLevel})` : "Rindā nekā nav."}</p>
          {game.queue?.cardSummary ? <p>{game.queue.cardSummary}</p> : null}
          <p>{game.active ? `Aktīvi: ${game.active.playerName ?? "visi"} — ${game.active.cardTitle}` : "Nav aktīva izsaukuma."}</p>
          {game.active?.cardSummary ? <p>{game.active.cardSummary}</p> : null}
          <p>{seconds !== null ? `Nākamais automātiskais logs pēc ${seconds} s` : "Automātiskais logs šobrīd negaida."}</p>
          {game.active?.tvHold ? <p>TV rāda izsaukumu, kamēr nospied Turpināt. Skenēt var visu šo laiku.</p> : null}
          {game.audioBlocked ? <p className="warn">TV pārlūks bloķē skaņu. Ekrānā jānospiež skaņas poga.</p> : null}
          {game.warnings[0] ? <p className="warn">{game.warnings[0].message}</p> : null}
          {game.phase === "ACTIVE_EVENT" || game.phase === "CARD_CLAIMED" ? (
            <div className="row">
              <button className="btn" type="button" onClick={() => void send({ type: "complete_event" })}>Apstiprināt izpildi</button>
              <button className="btn-ghost" type="button" onClick={() => void send({ type: "fail_event" })}>Nav izpildīts</button>
              <Winner players={game.players} onPick={(playerId) => void send({ type: "complete_event", winnerId: playerId })} />
            </div>
          ) : null}
        </section>

        <Prepare game={game} onSend={send} />
        <Players game={game} onSend={send} onTest={() => void send({ type: "add_test_players" })} codes={codes} />
        <Settings game={game} onSend={send} />
        <Missions game={game} onSend={send} />
        <section className="card">
          <h2>Vēsture</h2>
          <ul className="history">{game.history.map((item) => <li key={item.id}>{item.summary}</li>)}</ul>
        </section>
      </div>
    </main>
  );
}

function Swap({ players, onSwap }: { players: AdminState["players"]; onSwap: (id: string) => void }) {
  const [id, setId] = useState("");
  return (
    <div className="row">
      <select aria-label="Cits dalībnieks" value={id} onChange={(event) => setId(event.target.value)}>
        <option value="">Nomainīt uz…</option>
        {players.filter((player) => !player.removed && player.eligible).map((player) => <option key={player.id} value={player.id}>{player.publicName}</option>)}
      </select>
      <button className="btn-ghost" type="button" onClick={() => id && onSwap(id)}>Nomainīt</button>
    </div>
  );
}

function Winner({ players, onPick }: { players: AdminState["players"]; onPick: (id: string) => void }) {
  const [id, setId] = useState("");
  return (
    <div className="row">
      <select aria-label="Uzvarētājs" value={id} onChange={(event) => setId(event.target.value)}>
        <option value="">Dueļa uzvarētājs</option>
        {players.filter((player) => !player.removed).map((player) => <option key={player.id} value={player.id}>{player.publicName}</option>)}
      </select>
      <button className="btn-ghost" type="button" onClick={() => id && onPick(id)}>Reģistrēt</button>
    </div>
  );
}

function Prepare({ game, onSend }: { game: AdminState; onSend: (body: object) => Promise<void> }) {
  const [playerId, setPlayerId] = useState("");
  const [cardId, setCardId] = useState("");
  const globals = game.catalog.filter((card) => card.category === "GLOBAL");
  const cards = game.catalog.filter((card) => card.category !== "GLOBAL");
  return (
    <section className="card">
      <h2>Sagatavot izsaukumu</h2>
      <div className="grid">
        <label>Dalībnieks
          <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            <option value="">Nejaušs</option>
            {game.players.filter((player) => !player.removed && player.eligible).map((player) => <option key={player.id} value={player.id}>{player.publicName}</option>)}
          </select>
        </label>
        <label>Kartīte
          <select value={cardId} onChange={(event) => setCardId(event.target.value)}>
            <option value="">Nejauša</option>
            {cards.map((card) => <option key={card.id} value={card.id}>{card.category} · {card.title}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <button className="btn" type="button" onClick={() => void onSend({ type: "prepare", playerId: playerId || null, cardId: cardId || null })}>Sagatavot</button>
      </div>
      <div className="row">
        {globals.map((card) => <button className="btn-ghost" type="button" key={card.id} onClick={() => void onSend({ type: "activate_global", cardId: card.id })}>{card.title}</button>)}
      </div>
    </section>
  );
}

function Players({ game, onSend, onTest, codes }: { game: AdminState; onSend: (body: object) => Promise<void>; onTest: () => void; codes: { name: string; recoveryCode: string }[] }) {
  return (
    <section className="card">
      <h2>Dalībnieki</h2>
      <button className="btn-ghost" type="button" onClick={onTest}>Pievienot 6 testa dalībniekus</button>
      {codes.length ? <ul>{codes.map((code) => <li key={code.recoveryCode}>{code.name}: {code.recoveryCode}</li>)}</ul> : null}
      {game.players.map((player) => (
        <PlayerRow key={player.id} player={player} onSend={onSend} />
      ))}
    </section>
  );
}

function PlayerRow({ player, onSend }: { player: AdminState["players"][number]; onSend: (body: object) => Promise<void> }) {
  const [name, setName] = useState(player.name);
  if (player.removed) return <p className="quiet">{player.publicName} ir izņemts</p>;
  return (
    <div className="player">
      <div>
        <strong>{player.publicName}</strong>
        <div className="quiet">{player.online ? "tiešsaistē" : "nav nesen redzēts"} · izsaukumi {player.callCount}</div>
      </div>
      <input aria-label={`Vārds ${player.publicName}`} value={name} onChange={(event) => setName(event.target.value)} />
      <button className="btn-ghost" type="button" onClick={() => void onSend({ type: "rename_player", playerId: player.id, name })}>Labot</button>
      <div className="row">
        <button className="btn-ghost" type="button" onClick={() => void onSend({ type: "set_eligible", playerId: player.id, eligible: !player.eligible })}>{player.eligible ? "Neaicināt" : "Aicināt"}</button>
        <button className="btn-ghost" type="button" onClick={() => void onSend({ type: "reissue_recovery", playerId: player.id })}>Jauns kods</button>
        <button className="btn-danger" type="button" onClick={() => void onSend({ type: "remove_player", playerId: player.id })}>Izņemt</button>
      </div>
    </div>
  );
}

function Settings({ game, onSend }: { game: AdminState; onSend: (body: object) => Promise<void> }) {
  const [min, setMin] = useState(String(Math.round(game.settings.minIntervalSec / 60)));
  const [max, setMax] = useState(String(Math.round(game.settings.maxIntervalSec / 60)));
  const [mission, setMission] = useState(String(Math.round(game.settings.missionSeconds / 60)));
  const [weights, setWeights] = useState(game.settings.categoryWeights);
  const [active, setActive] = useState(game.settings.activeCategories);
  const [muted, setMuted] = useState(game.settings.standbyMuted);
  return (
    <section className="card">
      <h2>Automātika</h2>
      <div className="grid">
        <label>Minimums, min<input value={min} onChange={(event) => setMin(event.target.value)} inputMode="numeric" /></label>
        <label>Maksimums, min<input value={max} onChange={(event) => setMax(event.target.value)} inputMode="numeric" /></label>
        <label>Misija, minūtes<input value={mission} onChange={(event) => setMission(event.target.value)} inputMode="numeric" /></label>
      </div>
      <div className="grid">
        {AUTO_CATEGORIES.map((category) => (
          <label key={category}>{category}
            <input value={weights[category]} onChange={(event) => setWeights({ ...weights, [category]: Number(event.target.value) })} inputMode="numeric" />
          </label>
        ))}
      </div>
      <div className="row">
        {AUTO_CATEGORIES.map((category) => (
          <label key={category} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={active.includes(category)} onChange={(event) => setActive(event.target.checked ? [...active, category] : active.filter((item) => item !== category))} />
            {category}
          </label>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} />
        Standby video bez skaņas
      </label>
      <button className="btn" type="button" onClick={() => void onSend({
        type: "update_settings",
        patch: {
          minIntervalSec: Number(min) * 60,
          maxIntervalSec: Number(max) * 60,
          missionSeconds: Number(mission) * 60,
          categoryWeights: weights,
          activeCategories: active,
          standbyMuted: muted,
        },
      })}>Saglabāt iestatījumus</button>
    </section>
  );
}

function Missions({ game, onSend }: { game: AdminState; onSend: (body: object) => Promise<void> }) {
  return (
    <section className="card">
      <h2>Misijas un priekšrocības</h2>
      {game.missions.map((mission) => (
        <div className="player" key={mission.id}>
          <div><strong>{mission.playerName}</strong><div>{mission.text}</div><div className="quiet">{mission.status}</div></div>
          <button className="btn" type="button" onClick={() => void onSend({ type: "confirm_mission", missionId: mission.id })}>Apstiprināt</button>
          <button className="btn-ghost" type="button" onClick={() => void onSend({ type: "fail_mission", missionId: mission.id })}>Nav izpildīta</button>
        </div>
      ))}
      {game.perks.map((perk) => (
        <div className="player" key={perk.id}>
          <div><strong>{perk.playerName}</strong><div>{perk.name} — {perk.description}</div><div className="quiet">{perk.status}</div></div>
          {perk.status !== "used" ? <button className="btn" type="button" onClick={() => void onSend({ type: "confirm_perk", perkId: perk.id })}>Atzīmēt izmantotu</button> : null}
        </div>
      ))}
    </section>
  );
}
