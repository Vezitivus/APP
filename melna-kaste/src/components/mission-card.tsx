"use client";

import { useState } from "react";
import { api, savePlayerToken } from "@/lib/client/poll";
import { useEffect } from "react";

interface View {
  status: string;
  expiresAt?: string | null;
  mission?: { title: string; text: string; rules: string[]; status: string; deadlineAt: string; id: string };
  perk?: { name: string; description: string; status: string; id: string };
  card?: {
    title: string; summary: string; rules: string[]; durationSeconds: number; selection: string;
    partners: { id: string; name: string }[]; needsPartner: boolean; needsChoice: boolean; duelOnly: boolean;
  };
  roster?: { id: string; publicName: string }[];
  error?: { message?: string; code?: string };
}

export function MissionCard({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const result = await api<View>(`/api/mission/${token}`);
    setView(result.body);
  }

  useEffect(() => { void load(); }, [token]);

  async function recover(event: React.FormEvent) {
    event.preventDefault();
    const result = await api<{ token?: string; error?: { message?: string } }>("/api/player/recover", {
      method: "POST",
      body: JSON.stringify({ name, code }),
    });
    if (!result.body.token) setError(result.body.error?.message ?? "Neizdevās");
    else {
      savePlayerToken(result.body.token);
      setError("");
      await load();
    }
  }

  async function claim() {
    const result = await api<View>(`/api/mission/${token}`, { method: "POST" });
    if (result.status >= 400) setError(result.body.error?.message ?? "Kartīti nevar atvērt");
    else setView(result.body);
  }

  if (!view) return <main className="home"><p className="kicker">Melnā kaste</p></main>;
  if (view.status === "need_session" || view.status === "forbidden" && !view.mission) {
    if (view.status === "forbidden") {
      return <main className="home"><section className="frame"><h1>Šī kartīte nav tev</h1></section></main>;
    }
    return (
      <main className="home">
        <form className="frame" onSubmit={recover}>
          <p className="kicker">Privātā kartīte</p>
          <h1>Apstiprini, ka esi izsauktais</h1>
          <label>Vārds<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Atjaunošanas kods<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></label>
          {error ? <p className="warn">{error}</p> : null}
          <button className="btn" type="submit">Turpināt</button>
        </form>
      </main>
    );
  }
  if (view.status === "expired") return <main className="home"><section className="frame"><h1>Laiks ir beidzies</h1></section></main>;
  if (view.status === "inactive") return <main className="home"><section className="frame"><h1>Kartīte vairs nav aktīva</h1></section></main>;
  if (view.status === "ready") {
    return (
      <main className="home">
        <section className="frame">
          <p className="kicker">Melnā kaste</p>
          <h1>Atvērt kartīti</h1>
          {error ? <p className="warn">{error}</p> : null}
          <button className="btn" type="button" onClick={() => void claim()}>Atvērt</button>
        </section>
      </main>
    );
  }
  if (view.status === "mission" && view.mission) {
    return (
      <main className="home">
        <article className="mission">
          <p className="kicker">Tikai tev</p>
          <h1>{view.mission.title}</h1>
          <p>{view.mission.text}</p>
          <ul className="rules">{view.mission.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          <a className="btn" href="/player">Uz manu telefonu</a>
        </article>
      </main>
    );
  }
  if (view.status === "perk" && view.perk) {
    return (
      <main className="home">
        <article className="mission">
          <p className="kicker">Priekšrocība</p>
          <h1>{view.perk.name}</h1>
          <p>{view.perk.description}</p>
          <a className="btn" href="/player">Glabāt telefonā</a>
        </article>
      </main>
    );
  }
  if (view.status === "card" && view.card) {
    return (
      <main className="home">
        <article className="mission">
          <h1>{view.card.title}</h1>
          <p>{view.card.summary}</p>
          <ul className="rules">{view.card.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          {view.card.durationSeconds ? <p className="quiet">{view.card.durationSeconds} sekundes</p> : null}
          <a className="btn" href="/player">Turpināt telefonā</a>
        </article>
      </main>
    );
  }
  return <main className="home"><section className="frame"><h1>Kartīte nav pieejama</h1>{error ? <p className="warn">{error}</p> : null}</section></main>;
}
