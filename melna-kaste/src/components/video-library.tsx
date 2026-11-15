"use client";

import Link from "next/link";
import { useState } from "react";
import { api, usePoll } from "@/lib/client/poll";

interface Library {
  videos: { id: string; folder: string; filename: string; url: string; durationSeconds: number | null }[];
  standby: { filename: string; url: string }[];
  expected: { folder: string; filename: string; title: string; cardId: string | null; present: boolean }[];
  error?: { message?: string };
}

export function VideoLibrary() {
  const poll = usePoll<Library>("/api/admin/videos", 15000);
  const [message, setMessage] = useState("");
  const [card, setCard] = useState({ id: "", title: "", category: "FLASH", summary: "", rules: "", videoFile: "izsaukums_", minPlayers: "2" });

  async function sync() {
    const result = await api<{ count?: number; error?: { message?: string } }>("/api/admin/videos/sync", { method: "POST" });
    setMessage(result.status >= 400 ? result.body.error?.message ?? "Neizdevās" : `Atrasti ${result.body.count} video`);
    await poll.reload();
  }

  async function saveCard(event: React.FormEvent) {
    event.preventDefault();
    const result = await api<{ error?: { message?: string } }>("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        type: "upsert_card",
        card: {
          id: card.id,
          title: card.title,
          category: card.category,
          summary: card.summary,
          rules: card.rules.split("\n").map((line) => line.trim()).filter(Boolean),
          durationSeconds: 60,
          minPlayers: Number(card.minPlayers),
          idealGroup: Number(card.minPlayers),
          selection: Number(card.minPlayers) > 2 ? "system_many" : Number(card.minPlayers) > 1 ? "system_one" : "none",
          privacy: card.category === "MISSION" ? "secret_mission" : card.category === "PERK" ? "perk" : card.category === "GLOBAL" ? "public_event" : "private_card",
          videoFile: card.videoFile.endsWith(".mp4") ? card.videoFile : `${card.videoFile}.mp4`,
          categoryVideoFile: null,
          allowsDecline: true,
        },
      }),
    });
    setMessage(result.status >= 400 ? result.body.error?.message ?? "Kartīti neizdevās saglabāt" : "Kartīte saglabāta");
  }

  if (poll.status === 401) return <main className="home"><p>Vispirms jāieiet <Link href="/admin">režijā</Link>.</p></main>;
  const data = poll.data;

  return (
    <main className="sheet">
      <div className="panel">
        <p className="kicker"><Link href="/admin">Režija</Link> · Video</p>
        <h1>Bibliotēka</h1>
        <button className="btn" type="button" onClick={() => void sync()}>Atjaunot no Cloudinary</button>
        {message ? <p>{message}</p> : null}
        <section className="card">
          <h2>Standby secība</h2>
          <ol>{data?.standby.map((video) => <li key={video.filename}>{video.filename}</li>)}</ol>
          {!data?.standby.length ? <p className="quiet">Nav neviena standby_01.mp4 stila faila. TV rādīs testa ekrānu.</p> : null}
        </section>
        <section className="card">
          <h2>Sagaidāmie faili</h2>
          {data?.expected.map((file) => (
            <div className="player" key={`${file.folder}/${file.filename}`}>
              <div><strong>{file.filename}</strong><div className="quiet">{file.folder} · {file.title}</div></div>
              <span className="pill">{file.present ? "ir" : "trūkst"}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>Priekšskatījums</h2>
          {data?.videos.map((video) => (
            <div key={video.id}>
              <p>{video.folder}/{video.filename}</p>
              <video src={video.url} controls muted playsInline preload="none" style={{ width: "100%", maxHeight: 240 }} />
            </div>
          ))}
        </section>
        <form className="card" onSubmit={saveCard}>
          <h2>Jauna kartīte</h2>
          <div className="grid">
            <label>ID<input value={card.id} onChange={(event) => setCard({ ...card, id: event.target.value })} required /></label>
            <label>Nosaukums<input value={card.title} onChange={(event) => setCard({ ...card, title: event.target.value })} required /></label>
            <label>Kategorija
              <select value={card.category} onChange={(event) => setCard({ ...card, category: event.target.value })}>
                {["FLASH", "PAIR", "TEAM", "MISSION", "PERK", "CHOICE", "GLOBAL"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Minimums<input value={card.minPlayers} onChange={(event) => setCard({ ...card, minPlayers: event.target.value })} /></label>
          </div>
          <label>Video fails<input value={card.videoFile} onChange={(event) => setCard({ ...card, videoFile: event.target.value })} /></label>
          <label>Apraksts<textarea value={card.summary} onChange={(event) => setCard({ ...card, summary: event.target.value })} required /></label>
          <label>Noteikumi, pa rindai<textarea value={card.rules} onChange={(event) => setCard({ ...card, rules: event.target.value })} /></label>
          <button className="btn" type="submit">Saglabāt kartīti</button>
        </form>
      </div>
    </main>
  );
}
