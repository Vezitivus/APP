import { databaseConfigured, sql } from "@/lib/db/sql";
import { asResponse } from "@/lib/http/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return asResponse(async () => {
    if (!databaseConfigured()) return Response.json({ ok: false, database: false });
    await sql()`select 1 as ok`;
    return Response.json({ ok: true, database: true });
  });
}
