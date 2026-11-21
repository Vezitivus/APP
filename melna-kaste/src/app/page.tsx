import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <section className="frame">
        <p className="kicker">Pasākuma sistēma</p>
        <h1 className="display">Melnā kaste</h1>
        <p className="lede">
          Tā darbojas fonā. TV rāda, telefons saņem kartīti, un neviens iepriekš nezina, kurš tiks izsaukts.
        </p>
        <div className="actions">
          <Link className="btn" href="/join" prefetch={false}>Pievienoties</Link>
          <Link className="btn-ghost" href="/admin" prefetch={false}>Organizators</Link>
        </div>
      </section>
    </main>
  );
}
