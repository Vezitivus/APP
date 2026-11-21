"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PinField } from "@/components/pin-field";
import { api, savePlayerToken } from "@/lib/client/poll";

export function JoinForm() {
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<{ publicName: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pin !== pinConfirm) {
      setError("PIN apstiprinājums nesakrīt.");
      return;
    }
    const result = await api<{ publicName?: string; token?: string; error?: { message?: string } }>("/api/join", {
      method: "POST",
      body: JSON.stringify({ name, code, pin }),
    });
    if (result.status >= 400 || !result.body.token || !result.body.publicName) {
      setError(result.body.error?.message ?? "Neizdevās pievienoties");
      return;
    }
    savePlayerToken(result.body.token);
    setJoined({ publicName: result.body.publicName });
  }

  if (joined) {
    return (
      <main className="home">
        <section className="frame">
          <p className="kicker">Tu esi iekšā</p>
          <h1>{joined.publicName}</h1>
          <p className="lede">PIN paliek tikai tev. Ja kartīti atvērsi citā telefonā vai pēc sesijas dzēšanas, ievadi vārdu un šo PIN. Parasti paliec pieslēdzies.</p>
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
        <PinField label="Savs 4 ciparu PIN" value={pin} onChange={setPin} autoComplete="new-password" />
        <PinField label="Atkārto PIN" value={pinConfirm} onChange={setPinConfirm} autoComplete="new-password" />
        {error ? <p className="warn">{error}</p> : null}
        <button className="btn" type="submit">Pievienoties</button>
        <p className="quiet"><a href="/player">Jau reģistrējies? Atver kartīti ar vārdu un PIN.</a></p>
      </form>
    </main>
  );
}
