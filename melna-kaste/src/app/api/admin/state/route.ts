import { toAdminState } from "@/lib/game/project";
import { asResponse, jsonError } from "@/lib/http/http";
import { requireAdmin, serverCtx, tickedState } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET() {
  return asResponse(async () => {
    if (!(await requireAdmin())) return jsonError(401, "Nepieciešama organizatora pieteikšanās.", "auth");
    const state = await tickedState();
    if (!state) return Response.json({ game: null, serverNow: new Date().toISOString() });
    return Response.json({ game: toAdminState(state, serverCtx().now) });
  });
}
