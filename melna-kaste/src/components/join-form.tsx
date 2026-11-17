"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, savePlayerToken } from "@/lib/client/poll";

export function JoinForm() {
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<{ publicName: string; recoveryCode: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await api<{ publicName?: string; recoveryCode?: string; token?: string; error?: { message?: string } }>("/api/join", {
      method: "POST",
      body: JSON.stringify({ name, code }),
    });
    if (result.status >= 400 || !result.body.token || !result.body.publicName || !result.body.recoveryCode) {
      setError(result.body.error?.message ?? "Neizdevās pievienoties");
      return;
    }
    savePlayerToken(result.body.token);
    setJoined({ publicName: result.body.publicName, recoveryCode: result.body.recoveryCode });
  }

  if (joined) {
    return (
      <main className="home">
        <section className="frame">
          <p className="kicker">Tu esi iekšā</p>
          <h1>{joined.publicName}</h1>
          <p className="lede">Saglabā atjaunošanas kodu. Tas vajadzīgs, ja QR atveras citā pārlūkā.</p>
          <p className="code">{joined.recoveryCode}</p>
          <a className="btn" href="/player">Uz manu telefonu</a>
        </section>
      </main>
    );
  }

  return (
    <main className="home">
      <form className="frame" onSubmit={submit}>
        <p className="kicker">Pievienoties</p>
        <h1>Kā tevi saukt?</h1>
        <label>Vārds<input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required /></label>
        <label>Spēles kods<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
        {error ? <p className="warn">{error}</p> : null}
        <button className="btn" type="submit">Pievienoties</button>
      </form>
    </main>
  );
}
