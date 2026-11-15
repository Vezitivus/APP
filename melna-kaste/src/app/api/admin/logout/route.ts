import { cookies } from "next/headers";
import { cookieOptions } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  jar.set("mk_admin", "", { ...cookieOptions(0), maxAge: 0 });
  return Response.json({ ok: true });
}
