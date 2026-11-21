import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listCloudinaryVideos } from "../src/lib/cloudinary/sync";
import { standbyPlaylist } from "../src/lib/game/videos";

const CLOUD = "mana-kaste";
const AUTH = `Basic ${Buffer.from("key:secret").toString("base64")}`;

interface FakeResource {
  public_id: string;
  secure_url?: string;
  display_name?: string;
  original_filename?: string;
  resource_type?: string;
  type?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
}

function videoUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/${publicId}.mp4`;
}

function resource(partial: FakeResource): FakeResource {
  return {
    secure_url: videoUrl(partial.public_id),
    resource_type: "video",
    type: "upload",
    bytes: 1000,
    width: 1280,
    height: 720,
    duration: 3.5,
    ...partial,
  };
}

function installFetch(handler: (url: URL) => { status: number; body: unknown }) {
  const calls: { url: URL; authorization: string | null }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    calls.push({ url, authorization: headers.get("authorization") });
    const result = handler(url);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  });
  return calls;
}

function configure() {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
  process.env.CLOUDINARY_API_KEY = "key";
  process.env.CLOUDINARY_API_SECRET = "secret";
}

function endpoint(url: URL): { kind: "prefix" | "asset_folder"; folder: string } | null {
  if (url.pathname === `/v1_1/${CLOUD}/resources/video/upload`) {
    const prefix = url.searchParams.get("prefix") ?? "";
    const folder = prefix.replace(/^melna-kaste\//, "").replace(/\/$/, "");
    return { kind: "prefix", folder };
  }
  if (url.pathname === `/v1_1/${CLOUD}/resources/by_asset_folder`) {
    const folder = (url.searchParams.get("asset_folder") ?? "").replace(/^melna-kaste\//, "");
    return { kind: "asset_folder", folder };
  }
  return null;
}

afterEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  vi.unstubAllGlobals();
});

describe("Cloudinary video sinhronizācija", () => {
  it("fiksētajā mapju režīmā nolasa public id prefiksu un ignorē by_asset_folder 404", async () => {
    configure();
    const calls = installFetch((url) => {
      const route = endpoint(url);
      expect(route).not.toBeNull();
      if (route?.kind === "asset_folder") return { status: 404, body: { error: { message: "not found" } } };
      if (route?.folder === "standby" && !url.searchParams.get("next_cursor")) {
        return {
          status: 200,
          body: {
            resources: [resource({ public_id: "melna-kaste/standby/1" }), resource({ public_id: "melna-kaste/standby/standby_03" })],
            next_cursor: "lapa-2",
          },
        };
      }
      if (route?.folder === "standby") {
        return { status: 200, body: { resources: [resource({ public_id: "melna-kaste/standby/10", duration: 8 })] } };
      }
      if (route?.folder === "calls") {
        return {
          status: 200,
          body: {
            resources: [
              resource({ public_id: "melna-kaste/calls/izsaukums_sales_pitch" }),
              resource({ public_id: "melna-kaste/calls/izsaukums_flash" }),
              resource({ public_id: "melna-kaste/calls/izsaukums_look", secure_url: "https://evil.example/look.mp4" }),
            ],
          },
        };
      }
      return { status: 200, body: { resources: [resource({ public_id: "melna-kaste/special/special_open" })] } };
    });

    const videos = await listCloudinaryVideos();
    expect(videos.map((video) => `${video.folder}/${video.filename}`)).toEqual([
      "standby/1.mp4",
      "standby/standby_03.mp4",
      "standby/10.mp4",
      "calls/izsaukums_sales_pitch.mp4",
      "calls/izsaukums_flash.mp4",
      "special/special_open.mp4",
    ]);
    expect(videos.find((video) => video.filename === "10.mp4")?.durationSeconds).toBe(8);
    expect(standbyPlaylist(videos).map((video) => video.filename)).toEqual(["1.mp4", "standby_03.mp4", "10.mp4"]);
    expect(calls.every((call) => call.authorization === AUTH)).toBe(true);
    expect(calls.every((call) => !call.url.toString().includes("secret") && !call.url.toString().includes("key"))).toBe(true);
    const prefixes = calls
      .filter((call) => endpoint(call.url)?.kind === "prefix")
      .map((call) => call.url.searchParams.get("prefix"));
    expect(prefixes).toEqual(expect.arrayContaining(["melna-kaste/standby/", "melna-kaste/calls/", "melna-kaste/special/"]));
    expect(calls.some((call) => call.url.searchParams.get("next_cursor") === "lapa-2")).toBe(true);
    expect(calls.filter((call) => endpoint(call.url)?.kind === "prefix").every((call) => call.url.searchParams.get("max_results") === "100")).toBe(
      true,
    );
  });

  it("dinamiskajās mapēs nolasa asset_folder un vārdu no display_name vai original_filename", async () => {
    configure();
    installFetch((url) => {
      const route = endpoint(url);
      expect(route).not.toBeNull();
      if (route?.kind === "prefix") return { status: 200, body: { resources: [] } };
      if (route?.folder === "standby") {
        return {
          status: 200,
          body: {
            resources: [
              resource({ public_id: "1_xk3abc", display_name: "1", original_filename: "1" }),
              resource({ public_id: "8jsb1xofxdqamu2rzwt9q", display_name: "10.mp4", original_filename: "10" }),
              resource({ public_id: "aa11bb22cc33", display_name: "aa11bb22cc33", original_filename: "standby_02" }),
              resource({ public_id: "poster", display_name: "3", resource_type: "image" }),
              resource({ public_id: "hidden", display_name: "4", type: "authenticated" }),
            ],
          },
        };
      }
      if (route?.folder === "calls" && !url.searchParams.get("next_cursor")) {
        return {
          status: 200,
          body: {
            next_cursor: "calls-2",
            resources: [
              resource({ public_id: "izsaukums_flash_x7k2", display_name: "izsaukums_flash_x7k2", original_filename: "izsaukums_flash" }),
              resource({ public_id: "randomsales", display_name: "izsaukums_sales_pitch", original_filename: "izsaukums_sales_pitch" }),
              resource({ public_id: "onlysuffix", display_name: "izsaukums_bad_lawyer_q9zz" }),
            ],
          },
        };
      }
      if (route?.folder === "calls") {
        return {
          status: 200,
          body: {
            resources: [resource({ public_id: "anyid", display_name: "izsaukums_any", original_filename: "izsaukums_any" })],
          },
        };
      }
      return {
        status: 200,
        body: {
          resources: [
            resource({ public_id: "spec1", display_name: "special_open", original_filename: "special_open" }),
            resource({
              public_id: "spec2",
              display_name: "special_global_vote_ab12cd",
              original_filename: "special_global_vote",
            }),
          ],
        },
      };
    });

    const videos = await listCloudinaryVideos();
    expect(videos.map((video) => `${video.folder}/${video.filename}`)).toEqual([
      "standby/1.mp4",
      "standby/10.mp4",
      "standby/standby_02.mp4",
      "calls/izsaukums_flash.mp4",
      "calls/izsaukums_sales_pitch.mp4",
      "calls/izsaukums_bad_lawyer.mp4",
      "calls/izsaukums_any.mp4",
      "special/special_open.mp4",
      "special/special_global_vote.mp4",
    ]);
    expect(standbyPlaylist(videos).map((video) => video.filename)).toEqual(["1.mp4", "standby_02.mp4", "10.mp4"]);
    expect(videos.find((video) => video.publicId === "randomsales")?.filename).toBe("izsaukums_sales_pitch.mp4");
  });

  it("to pašu public id liek Media Library mapē, nevis public id prefiksa mapē", async () => {
    configure();
    installFetch((url) => {
      const route = endpoint(url);
      if (route?.kind === "prefix" && route.folder === "standby") {
        return { status: 200, body: { resources: [resource({ public_id: "shared" })] } };
      }
      if (route?.kind === "prefix") return { status: 200, body: { resources: [] } };
      if (route?.folder === "calls") {
        return { status: 200, body: { resources: [resource({ public_id: "shared", display_name: "izsaukums_flash" })] } };
      }
      return { status: 200, body: { resources: [] } };
    });

    const videos = await listCloudinaryVideos();
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ folder: "calls", filename: "izsaukums_flash.mp4", publicId: "shared" });
  });

  it("atmet kļūdas statusu un tukšu konfigurāciju", async () => {
    await expect(listCloudinaryVideos()).rejects.toThrow("Cloudinary nav konfigurēts");
    configure();
    installFetch((url) => {
      const route = endpoint(url);
      if (route?.kind === "asset_folder") return { status: 500, body: { error: { message: "boom" } } };
      return { status: 200, body: { resources: [] } };
    });
    await expect(listCloudinaryVideos()).rejects.toThrow("Cloudinary atbildēja ar statusu 500");
  });
});
