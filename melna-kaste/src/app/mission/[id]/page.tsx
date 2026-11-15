import { MissionCard } from "@/components/mission-card";

export const dynamic = "force-dynamic";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MissionCard token={id} />;
}
