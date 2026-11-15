"use client";

import { useState } from "react";
import type { PlayerState } from "@/lib/game/project";
import { api, savePlayerToken, useClock, usePoll } from "@/lib/client/poll";

export function PlayerHome() {
  const poll = usePoll<{ game: PlayerState }>("/api/player/state", 2500);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const game = poll.data?.game;
  const now = useClock(game?.serverNow);

  async function recover(event: React.FormEvent) {
    event.preventDefault();
    const result = await api<{ token?: string; error?: { message?: string } }>("/api/player/recover", {
      method: "POST",
      body: JSON.stringify({ name, code }),
    });
    if (result.status >= 400 || !result.body.token) setError(result.body.error?.message ?? "Neizdevās");
    else {
      savePlayerToken(result.body.token);
      setError("");
      await poll.reload();
    }
  }

  async function act(body: object) {
    const result = await api<{ error?: { message?: string } }>("/api/player/action", { method: "POST", body: JSON.stringify(body) });
    if (result.status >= 400) setError(result.body.error?.message ?? "Neizdevās");
    else setError("");
    await poll.reload();
  }

  if (poll.status === null && !poll.error) return <main className="home"><p className="kicker">Melnā kaste</p></main>;

  if (poll.status === 401 || !game) {
    return (
      <main className="home">
        <form className="frame" onSubmit={recover}>
          <p className="kicker">Mans telefons</p>
          <h1>Atjaunot sesiju</h1>
          <label>Vārds<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Atjaunošanas kods<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></label>
          {error || poll.error ? <p className="warn">{error || poll.error}</p> : null}
          <button className="btn" type="submit">Atvērt</button>
        </form>
      </main>
    );
  }

  return (
    <main className="sheet">
      <div className="panel">
        <p className="kicker">{game.publicName}</p>
        {error ? <p className="warn">{error}</p> : null}
        {game.card ? <CardForm game={game} onAct={act} /> : <p className="lede">Šobrīd tev nav jaunas kartītes. Uzaicinājums parādīsies uz TV.</p>}
        {game.missions.map((mission) => {
          const left = Math.max(0, Math.round((Date.parse(mission.deadlineAt) - now) / 1000));
          return (
            <article className="card" key={mission.id}>
              <h2>{mission.title}</h2>
              <p>{mission.text}</p>
              <ul className="rules">{mission.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
              <p className="quiet">{mission.status === "active" ? `Atlicis ${Math.ceil(left / 60)} min` : mission.status}</p>
              {mission.status === "active" ? <button className="btn" type="button" onClick={() => void act({ type: "complete_mission", missionId: mission.id })}>Izpildīts</button> : null}
            </article>
          );
        })}
        {game.perks.map((perk) => (
          <article className="card" key={perk.id}>
            <h2>{perk.name}</h2>
            <p>{perk.description}</p>
            <p className="quiet">{perk.status === "used" ? "Jau izmantota" : "Vēl nav izmantota"}</p>
            {perk.status === "available" ? <button className="btn" type="button" onClick={() => void act({ type: "request_perk", perkId: perk.id })}>Lūgt apstiprināt</button> : null}
          </article>
        ))}
      </div>
    </main>
  );
}

function CardForm({ game, onAct }: { game: PlayerState; onAct: (body: object) => Promise<void> }) {
  const card = game.card!;
  const [mode, setMode] = useState<"duel" | "group">(card.duelOnly ? "duel" : "duel");
  const [title, setTitle] = useState("");
  const [rules, setRules] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    const single = card.selection === "player_one" || (card.needsChoice && mode === "duel") || card.duelOnly;
    if (single) setPicked([id]);
    else setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <article className="mission">
      <p className="kicker">{card.category}</p>
      <h1>{card.title}</h1>
      <p>{card.summary}</p>
      <ul className="rules">{card.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      {card.partners.length ? <p>Kopā ar: {card.partners.map((partner) => partner.name).join(", ")}</p> : null}
      {card.needsChoice ? (
        <div className="choice">
          {card.duelOnly ? null : (
            <div className="row">
              <button className={mode === "duel" ? "btn" : "btn-ghost"} type="button" onClick={() => { setMode("duel"); setPicked([]); }}>Duelis</button>
              <button className={mode === "group" ? "btn" : "btn-ghost"} type="button" onClick={() => { setMode("group"); setPicked([]); }}>Kopīga aktivitāte</button>
            </div>
          )}
          <label>Aktivitāte<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>
          <label>Noteikumi, ja vajag<textarea value={rules} onChange={(event) => setRules(event.target.value)} maxLength={280} /></label>
        </div>
      ) : null}
      {card.needsPartner || card.needsChoice ? (
        <div className="choice">
          {game.roster.map((person) => (
            <label key={person.id}><input type={card.needsChoice && mode === "group" ? "checkbox" : "radio"} name="partner" checked={picked.includes(person.id)} onChange={() => toggle(person.id)} /> {person.publicName}</label>
          ))}
        </div>
      ) : null}
      {card.needsPartner || card.needsChoice ? (
        <button className="btn" type="button" onClick={() => void onAct({ type: "submit_selection", partnerIds: picked, activityTitle: title, activityRules: rules, mode: card.needsChoice ? mode : undefined })}>Apstiprināt</button>
      ) : null}
      <button className="btn-ghost" type="button" onClick={() => void onAct({ type: "decline" })}>Atteikties</button>
    </article>
  );
}
