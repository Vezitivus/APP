import { redirect } from "next/navigation";
import { TvScreen } from "@/components/tv-screen";

export const dynamic = "force-dynamic";

export default async function TvPage({ searchParams }: { searchParams: Promise<{ pair?: string }> }) {
  const params = await searchParams;
  if (params.pair && params.pair !== "invalid") {
    redirect(`/api/tv/pair?token=${encodeURIComponent(params.pair)}`);
  }
  return <TvScreen invalidPair={params.pair === "invalid"} />;
}
