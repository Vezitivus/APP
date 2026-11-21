import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { inflateSync } from "node:zlib";
import { chromium, type Page } from "playwright";

const ROOT = join(import.meta.dirname, "dist");
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mp4": "video/mp4",
};

export function averageLuma(png: Buffer): { avg: number; min: number; max: number; pixels: number } {
  const data = Buffer.from(png);
  if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
    throw new Error(`not a png (${data.length} bytes, header=${data.subarray(0, 16).toString("hex")})`);
  }
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === "IDAT") chunks.push(chunk);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!width || !height) throw new Error("no IHDR");
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported png ${bitDepth}/${colorType}`);
  const raw = inflateSync(Buffer.concat(chunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const image = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const dest = y * stride;
    const prev = y === 0 ? null : image.subarray((y - 1) * stride, y * stride);
    for (let i = 0; i < stride; i += 1) {
      const sample = raw[src + i];
      const left = i >= bpp ? image[dest + i - bpp] : 0;
      const up = prev ? prev[i] : 0;
      const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
      let value = sample;
      if (filter === 1) value = (sample + left) & 255;
      else if (filter === 2) value = (sample + up) & 255;
      else if (filter === 3) value = (sample + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (sample + pr) & 255;
      } else if (filter !== 0) throw new Error(`unsupported png filter ${filter}`);
      image[dest + i] = value;
    }
    src += stride;
  }
  let sum = 0;
  let min = 255;
  let max = 0;
  let pixels = 0;
  for (let i = 0; i < image.length; i += bpp) {
    const luma = 0.2126 * image[i] + 0.7152 * image[i + 1] + 0.0722 * image[i + 2];
    sum += luma;
    if (luma < min) min = luma;
    if (luma > max) max = luma;
    pixels += 1;
  }
  return { avg: sum / pixels, min, max, pixels };
}

function startServer() {
  const server = createServer((request, response) => {
    const url = request.url ?? "/";
    if (url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const path = join(ROOT, url === "/" ? "index.html" : url);
    if (!path.startsWith(ROOT) || !existsSync(path)) {
      response.writeHead(404);
      response.end("missing");
      return;
    }
    const type = TYPES[extname(path)] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    response.end(readFileSync(path));
  });
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

async function sample(page: Page) {
  const shot = await page.locator(".picture").screenshot({ type: "png" });
  return averageLuma(shot);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/favicon|404 \(Not Found\)/i.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (request) => {
    if (!request.url().includes("favicon")) consoleErrors.push(`request failed ${request.url()}`);
  });
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.waitForSelector("video.layer.front");
  await page.waitForFunction(() => {
    const video = document.querySelector("video.layer.front") as HTMLVideoElement | null;
    return Boolean(video && video.readyState >= 2 && !video.paused && video.currentTime > 0);
  }, { timeout: 10_000 });

  const shots: { t: number; png: Buffer; index: string | null }[] = [];
  const started = Date.now();
  // 1.2s clips, capture ~5.2s to include several transitions including the wrap back to red
  while (Date.now() - started < 5200) {
    const png = await page.locator(".picture").screenshot({ type: "png" });
    const index = await page.locator(".picture").getAttribute("data-index");
    shots.push({ t: Date.now() - started, png, index });
  }
  const frames = shots.map((shot) => ({ t: shot.t, ...averageLuma(shot.png), index: shot.index }));

  const avgs = frames.map((frame) => frame.avg);
  const mins = frames.map((frame) => frame.avg); // per-frame average; a black frame would make this ~0
  const result = {
    frames: frames.length,
    intervalMs: 30,
    minFrameAvg: Math.min(...avgs),
    maxFrameAvg: Math.max(...avgs),
    meanFrameAvg: avgs.reduce((a, b) => a + b, 0) / avgs.length,
    transitionsSeen: new Set(frames.map((frame) => frame.index)).size,
    darkestFrame: frames.reduce((best, frame) => (frame.avg < best.avg ? frame : best)),
    consoleErrors,
  };
  const out = join(import.meta.dirname, "crossfade-results.json");
  writeFileSync(out, JSON.stringify({ result, frames }, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
  await server.close();

  if (result.transitionsSeen < 3) throw new Error(`expected several clip transitions, saw ${result.transitionsSeen}`);
  if (result.minFrameAvg < 20) throw new Error(`black or near-black frame: min average luma ${result.minFrameAvg.toFixed(2)} (0-255)`);
  if (result.consoleErrors.length) throw new Error(`console errors: ${result.consoleErrors.join(" | ")}`);
  console.log(`PASS no black frames: min=${result.minFrameAvg.toFixed(2)} mean=${result.meanFrameAvg.toFixed(2)} max=${result.maxFrameAvg.toFixed(2)} over ${result.frames} frames`);
}

main().catch((error) => { console.error(error); process.exit(1); });
