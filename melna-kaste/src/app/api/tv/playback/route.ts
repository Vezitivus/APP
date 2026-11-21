import { limit, mutate } from "@/lib/db/repository";
import { toTvState } from "@/lib/game/project";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { pairedTv, serverCtx } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return asResponse(async () => {
    if (!(await pairedTv())) return jsonError(401, "TV nav savienots ar režiju.", "auth");
    await limit(`tv:${clientIp(request)}`, 240, 60 * 1000);
    const body = (await request.json().catch(() => null)) as {
      type?: string;
      cycleId?: string;
      clipToken?: string;
      blocked?: boolean;
      intact?: boolean;
    } | null;
    if (!body?.type) return jsonError(400, "Nederīgs pieprasījums.", "invalid");
    const ctx = serverCtx();
    const action =
      body.type === "ended" && body.cycleId && body.clipToken
        ? { type: "clip_ended" as const, cycleId: body.cycleId, clipToken: body.clipToken }
        : body.type === "failed" && body.cycleId && body.clipToken
          ? { type: "clip_failed" as const, cycleId: body.cycleId, clipToken: body.clipToken }
        : body.type === "cycle" && body.cycleId
          ? { type: "cycle_ended" as const, cycleId: body.cycleId, intact: body.intact !== false }
          : body.type === "audio"
            ? { type: "audio_blocked" as const, blocked: Boolean(body.blocked) }
            : body.type === "test_cycle"
              ? { type: "complete_test_cycle" as const }
              : null;
    if (!action) return jsonError(400, "Nederīgs pieprasījums.", "invalid");
    const result = await mutate(action, ctx);
    if (result.error) return jsonError(409, result.error.message, result.error.code);
    return Response.json({ ignored: Boolean(result.ignored), game: toTvState(result.state, ctx.now, { includePreload: true }) });
  });
}
