import { cookies } from "next/headers";
import { adminConfigured, adminPasswordOk } from "@/lib/auth/crypto";
import { limit } from "@/lib/db/repository";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { adminCookie, cookieOptions } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return asResponse(async () => {
    if (!adminConfigured()) return jsonError(503, "ADMIN_PASSWORD vai SESSION_SECRET nav iestatīts.", "config");
    await limit(`login:${clientIp(request)}`, 8, 15 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    if (!body || typeof body.password !== "string" || !adminPasswordOk(body.password)) {
      return jsonError(401, "Nepareiza parole.", "auth");
    }
    const jar = await cookies();
    jar.set("mk_admin", adminCookie(), cookieOptions(60 * 60 * 12));
    return Response.json({ ok: true });
  });
}
