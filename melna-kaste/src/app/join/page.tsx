import { Suspense } from "react";
import { JoinForm } from "@/components/join-form";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <Suspense fallback={<main className="home"><p className="kicker">Melnā kaste</p></main>}>
      <JoinForm />
    </Suspense>
  );
}
