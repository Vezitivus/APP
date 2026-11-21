const PIN_PATTERN = /^\d{4}$/;
const HASH_PREFIX = "pbkdf2$sha256$";

/** PBKDF2-SHA-256 iterations. Low enough for Workers Free CPU, high enough with a unique salt and lockout. */
export const PIN_ITERATIONS = 10_000;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;

const SALT_BYTES = 16;
const KEY_BITS = 256;

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("bad hex");
  const out = new Uint8Array(value.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const saltCopy = new Uint8Array(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltCopy.buffer.slice(saltCopy.byteOffset, saltCopy.byteOffset + saltCopy.byteLength) as ArrayBuffer,
      iterations,
    },
    material,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error("invalid pin");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, PIN_ITERATIONS);
  return `${HASH_PREFIX}${PIN_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!isValidPin(pin) || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;
  try {
    const salt = fromHex(parts[3]);
    const expected = fromHex(parts[4]);
    const actual = await derive(pin, salt, iterations);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let index = 0; index < actual.length; index += 1) diff |= actual[index] ^ expected[index];
    return diff === 0;
  } catch {
    return false;
  }
}

export function pinLockedUntil(lockedUntil: string | null | undefined, now: number): number | null {
  if (!lockedUntil) return null;
  const at = Date.parse(lockedUntil);
  if (!Number.isFinite(at) || at <= now) return null;
  return at;
}
