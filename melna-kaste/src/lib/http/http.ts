export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const value = forwarded ? forwarded.split(",")[0].trim() : "local";
  return value.slice(0, 64) || "local";
}

export function jsonError(status: number, message: string, code = "error"): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function publicOrigin(request: Request): string {
  const configured = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function asResponse(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "42P01") {
      return jsonError(503, "Datubāzes shēma nav izveidota. Palaid supabase/migrations/0001_init.sql.", "schema");
    }
    if (code === "rate") return jsonError(429, "Pārāk daudz mēģinājumu. Uzgaidi brīdi.", "rate");
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) return jsonError(503, "Datubāze nav pievienota.", "config");
    if (message.includes("SESSION_SECRET")) return jsonError(503, "SESSION_SECRET nav iestatīts.", "config");
    if (!message.includes("postgres://") && !message.toLowerCase().includes("password")) {
      console.error(message || error);
    }
    return jsonError(500, "Servera kļūda.", "server");
  }
}
