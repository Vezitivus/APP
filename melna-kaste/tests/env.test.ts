import { afterEach, describe, expect, it } from "vitest";
import { adminConfigured } from "../src/lib/auth/crypto";
import { cloudinaryConfigured } from "../src/lib/cloudinary/sync";
import { serverEnv } from "../src/lib/server/env";

const names = [
  "ADMIN_PASSWORD",
  "SESSION_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "PUBLIC_URL",
] as const;

afterEach(() => {
  for (const name of names) delete process.env[name];
});

describe("servera vide", () => {
  it("nolasa vērtību izsaukuma brīdī, nevis moduļa ielādes brīdī", () => {
    expect(serverEnv("PUBLIC_URL")).toBeUndefined();
    process.env.PUBLIC_URL = "https://melna-kaste.example.workers.dev";
    expect(serverEnv("PUBLIC_URL")).toBe("https://melna-kaste.example.workers.dev");
    delete process.env.PUBLIC_URL;
    expect(serverEnv("PUBLIC_URL")).toBeUndefined();
  });

  it("admin un Cloudinary karogi seko runtime vērtībām", () => {
    expect(adminConfigured()).toBe(false);
    expect(cloudinaryConfigured()).toBe(false);
    process.env.ADMIN_PASSWORD = "12345678";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.CLOUDINARY_CLOUD_NAME = "melna";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    expect(adminConfigured()).toBe(true);
    expect(cloudinaryConfigured()).toBe(true);
  });
});