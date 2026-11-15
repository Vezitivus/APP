import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consumeTvPair, limit } from "@/lib/db/repository";
import { asResponse, clientIp, jsonError } from "@/lib/http/http";
import { cookieOptions, tvCookie } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return asResponse(async () => {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const gameId = token ? await consumeTvPair(token) : null;
    if (!gameId) return NextResponse.redirect(new URL("/tv?pair=invalid", request.url));
    const response = NextResponse.redirect(new URL("/tv", request.url));
    response.cookies.set("mk_tv", tvCookie(gameId), cookieOptions(60 * 60 * 18));
    return response;
  });
}

export async function POST(request: Request) {
  return asResponse(async () => {
    await limit(`tv-pair:${clientIp(request)}`, 20, 10 * 60 * 1000);
    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    const gameId = body?.token ? await consumeTvPair(body.token.trim()) : null;
    if (!gameId) return jsonError(401, "TV saite vairs nav derīga.", "auth");
    const jar = await cookies();
    jar.set("mk_tv", tvCookie(gameId), cookieOptions(60 * 60 * 18));
    return Response.json({ ok: true });
  });
}
