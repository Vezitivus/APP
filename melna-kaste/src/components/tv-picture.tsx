"use client";

import { useEffect, useRef, useState } from "react";
import {
  CROSSFADE_SECONDS,
  applyCrossfadeStyle,
  cloudinaryPlaybackUrl,
  crossfadeStyle,
  deliveryKey,
  lastFrameTime,
  shouldPrerollSwap,
} from "@/lib/tv/playback";

const LAYER_COUNT = 3;

function attrSrc(video: HTMLVideoElement | null): string | null {
  if (!video) return null;
  return video.getAttribute("src");
}

function sameSrc(video: HTMLVideoElement | null, url: string | null): boolean {
  return Boolean(url && deliveryKey(attrSrc(video)) === deliveryKey(url));
}

function freezeLastFrame(video: HTMLVideoElement) {
  video.pause();
  const time = lastFrameTime(video.duration);
  if (time === null) return;
  try {
    if (Math.abs(video.currentTime - time) > 0.03) video.currentTime = time;
  } catch {
    /* seeking may fail if metadata is gone */
  }
}

function captureFrame(video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null) {
  if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    /* cross-origin without CORS would taint the canvas; videos set crossOrigin */
  }
}

function waitUntil(video: HTMLVideoElement, ok: () => boolean, events: string[], signal: { cancelled: boolean }): Promise<boolean> {
  if (ok()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      for (const event of events) video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      resolve(value);
    };
    const onEvent = () => {
      if (signal.cancelled) return finish(false);
      if (ok()) finish(true);
    };
    const onError = () => finish(false);
    for (const event of events) video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
    if (ok()) finish(true);
  });
}

function waitForDecodedFrame(video: HTMLVideoElement, signal: { cancelled: boolean }): Promise<boolean> {
  const rvfc = (
    video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number }
  ).requestVideoFrameCallback;
  if (typeof rvfc === "function") {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const id = rvfc.call(video, () => finish(!signal.cancelled));
      video.addEventListener(
        "error",
        () => {
          if (typeof video.cancelVideoFrameCallback === "function" && typeof id === "number") {
            video.cancelVideoFrameCallback(id);
          }
          finish(false);
        },
        { once: true },
      );
    });
  }
  return waitUntil(video, () => !signal.cancelled && !video.paused && video.readyState >= 2, ["playing", "canplay", "loadeddata"], signal);
}

function runCrossfade(incoming: HTMLVideoElement, outgoing: HTMLVideoElement, signal: { cancelled: boolean }): Promise<void> {
  const durationMs = CROSSFADE_SECONDS * 1000;
  const started = performance.now();
  incoming.classList.add("entering");
  outgoing.classList.add("leaving");
  return new Promise((resolve) => {
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs);
      const next = crossfadeStyle(progress, "incoming");
      const prev = crossfadeStyle(progress, "outgoing");
      applyCrossfadeStyle(incoming, next.opacity, next.blur);
      applyCrossfadeStyle(outgoing, prev.opacity, prev.blur);
      if (progress >= 1 || signal.cancelled) {
        incoming.classList.remove("entering");
        outgoing.classList.remove("leaving");
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export function TvPicture(props: {
  url: string | null;
  nextUrl: string | null;
  preloadUrls: string[];
  loop: boolean;
  muted: boolean;
  cycleId: string;
  clipToken: string;
  armed: boolean;
  onEnded: (cycleId: string, clipToken: string) => void;
  onFailed: (cycleId: string, clipToken: string) => void;
  onPlayBlocked?: () => void;
}) {
  const layers = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [front, setFront] = useState(0);
  const frontIndex = useRef(0);
  const swapLock = useRef(false);
  const reported = useRef<string | null>(null);
  const fails = useRef(0);
  const pendingUrl = useRef<string | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  frontIndex.current = front;

  const layer = (index: number) => layers[index].current;
  const visible = () => layer(frontIndex.current);
  const allLayers = () => layers.map((item) => item.current).filter((item): item is HTMLVideoElement => Boolean(item));

  function idleLayer(preferredSrc?: string | null): HTMLVideoElement | null {
    const shown = visible();
    if (preferredSrc) {
      const match = allLayers().find((video) => video !== shown && sameSrc(video, preferredSrc));
      if (match) return match;
    }
    return allLayers().find((video) => video !== shown) ?? null;
  }

  function fill(video: HTMLVideoElement, src: string) {
    video.preload = "auto";
    video.playsInline = true;
    video.muted = true;
    video.crossOrigin = "anonymous";
    if (attrSrc(video) === src) {
      if (video.readyState < 3) video.load();
      return;
    }
    video.setAttribute("src", src);
    video.load();
  }

  function holdFrame(video: HTMLVideoElement | null) {
    if (!video) return;
    captureFrame(video, canvasRef.current);
    if (video.ended || (Number.isFinite(video.duration) && video.duration - video.currentTime <= 0.05)) {
      freezeLastFrame(video);
      captureFrame(video, canvasRef.current);
    }
  }

  async function playLayer(video: HTMLVideoElement, muted: boolean, loop: boolean) {
    video.loop = loop;
    video.muted = muted;
    video.playsInline = true;
    try {
      await video.play();
      return true;
    } catch {
      if (!muted) {
        video.muted = true;
        try {
          await video.play();
          if (!muted) propsRef.current.onPlayBlocked?.();
          return true;
        } catch {
          if (!muted) propsRef.current.onPlayBlocked?.();
          return false;
        }
      }
      return false;
    }
  }

  function assignClasses(shown: HTMLVideoElement, hidden: HTMLVideoElement[]) {
    shown.classList.remove("back", "entering", "leaving");
    shown.classList.add("front");
    applyCrossfadeStyle(shown, 1, 0);
    shown.style.opacity = "";
    shown.style.filter = "";
    for (const video of hidden) {
      video.classList.remove("front", "entering", "leaving");
      video.classList.add("back");
      applyCrossfadeStyle(video, 0, 8);
      video.style.opacity = "";
      video.style.filter = "";
    }
  }

  function reportEnded(cycleId: string, clipToken: string) {
    const key = `${cycleId}:${clipToken}`;
    if (reported.current === key) return;
    reported.current = key;
    propsRef.current.onEnded(cycleId, clipToken);
  }

  /** Advance the current clip: crossfade into the next play URL, or just report ended so hold/QR can start. */
  function finishCurrent(video: HTMLVideoElement, report = true) {
    if (video !== visible() || video.loop || swapLock.current) return;
    holdFrame(video);
    const next = cloudinaryPlaybackUrl(propsRef.current.nextUrl);
    if (next && !sameSrc(video, next)) {
      void overlap(video, next, { cancelled: false }, report);
      return;
    }
    if (report) {
      reportEnded(video.dataset.cycle ?? propsRef.current.cycleId, video.dataset.token ?? propsRef.current.clipToken);
    }
  }

  function primeBuffers(currentUrl: string | null) {
    const currentKey = deliveryKey(currentUrl);
    const needed = propsRef.current.preloadUrls
      .map((item) => cloudinaryPlaybackUrl(item))
      .filter((item): item is string => Boolean(item && deliveryKey(item) !== currentKey));
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const url of needed) {
      const key = deliveryKey(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(url);
    }
    const shown = visible();
    const buffers = allLayers().filter((video) => video !== shown);
    for (const url of unique.slice(0, buffers.length)) {
      const already = buffers.find((video) => sameSrc(video, url));
      const slot = already ?? buffers.find((video) => !unique.some((item) => sameSrc(video, item))) ?? null;
      if (slot && !swapLock.current) fill(slot, url);
    }
  }

  async function overlap(outgoing: HTMLVideoElement, incomingUrl: string | null, signal: { cancelled: boolean }, report = true) {
    if (swapLock.current || signal.cancelled || outgoing !== visible()) return false;
    const next = cloudinaryPlaybackUrl(incomingUrl);
    if (!next || sameSrc(outgoing, next)) return false;
    const incoming = idleLayer(next);
    if (!incoming) return false;
    swapLock.current = true;
    holdFrame(outgoing);
    const cycleId = outgoing.dataset.cycle ?? propsRef.current.cycleId;
    const clipToken = outgoing.dataset.token ?? propsRef.current.clipToken;
    if (!sameSrc(incoming, next)) fill(incoming, next);

    const ready = () => incoming.readyState >= 3 || (incoming.readyState >= 2 && incoming.duration > 0);
    let ok = ready();
    if (!ok) {
      const waitReady = waitUntil(incoming, ready, ["canplaythrough", "canplay", "loadeddata"], signal);
      const remaining = outgoing.duration - outgoing.currentTime;
      if (Number.isFinite(remaining) && remaining > 0.04) {
        ok = await Promise.race([
          waitReady,
          new Promise<boolean>((resolve) => {
            const onEnd = () => {
              holdFrame(outgoing);
              resolve(ready());
            };
            outgoing.addEventListener("ended", onEnd, { once: true });
            window.setTimeout(() => {
              outgoing.removeEventListener("ended", onEnd);
              resolve(ready());
            }, Math.max(40, remaining * 1000 + 80));
          }),
        ]);
      } else {
        ok = await waitReady;
      }
    }
    if (!ok || signal.cancelled) {
      holdFrame(outgoing);
      if (!ready()) await waitUntil(incoming, ready, ["canplaythrough", "canplay", "loadeddata"], signal);
    }
    if (signal.cancelled || incoming.readyState < 2) {
      swapLock.current = false;
      return false;
    }

    incoming.dataset.cycle = propsRef.current.cycleId;
    incoming.dataset.token = propsRef.current.clipToken;
    incoming.loop = propsRef.current.loop;
    holdFrame(outgoing);
    const started = await playLayer(incoming, true, propsRef.current.loop);
    if (!started || signal.cancelled) {
      holdFrame(outgoing);
      swapLock.current = false;
      return false;
    }
    const framed = await waitForDecodedFrame(incoming, signal);
    if (!framed) {
      holdFrame(outgoing);
      swapLock.current = false;
      return false;
    }
    captureFrame(incoming, canvasRef.current);
    if (propsRef.current.armed) incoming.muted = propsRef.current.muted;
    await runCrossfade(incoming, outgoing, signal);
    holdFrame(incoming);
    freezeLastFrame(outgoing);
    outgoing.muted = true;
    outgoing.loop = false;
    const index = layers.findIndex((item) => item.current === incoming);
    assignClasses(incoming, allLayers().filter((video) => video !== incoming));
    frontIndex.current = index >= 0 ? index : frontIndex.current;
    setFront(frontIndex.current);
    if (propsRef.current.armed) incoming.muted = propsRef.current.muted;
    swapLock.current = false;
    fails.current = 0;
    if (report) reportEnded(cycleId, clipToken);
    primeBuffers(next);
    const queued = pendingUrl.current;
    pendingUrl.current = null;
    if (queued && !sameSrc(visible(), queued)) {
      const shown = visible();
      if (shown) void overlap(shown, queued, { cancelled: false }, false);
    }
    return true;
  }

  useEffect(() => {
    const signal = { cancelled: false };
    const desired = cloudinaryPlaybackUrl(props.url);
    const current = visible();
    if (!current) return () => {
      signal.cancelled = true;
    };

    void (async () => {
      if (!desired) {
        if (current.getAttribute("src")) holdFrame(current);
        return;
      }
      current.loop = props.loop;
      current.dataset.cycle = props.cycleId;
      current.dataset.token = props.clipToken;
      if (sameSrc(current, desired)) {
        pendingUrl.current = null;
        if (props.armed || props.muted) await playLayer(current, props.muted || !props.armed, props.loop);
        if (props.armed) current.muted = props.muted;
        primeBuffers(desired);
        return;
      }
      if (swapLock.current) {
        pendingUrl.current = desired;
        return;
      }
      if (!attrSrc(current)) {
        fill(current, desired);
        const ready = await waitUntil(current, () => current.readyState >= 2, ["canplay", "loadeddata", "canplaythrough"], signal);
        if (!ready || signal.cancelled) return;
        applyCrossfadeStyle(current, 1, 0);
        await playLayer(current, true, props.loop);
        await waitForDecodedFrame(current, signal);
        captureFrame(current, canvasRef.current);
        if (props.armed) current.muted = props.muted;
        primeBuffers(desired);
        return;
      }
      await overlap(current, desired, signal, false);
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [props.url, props.cycleId, props.clipToken, props.loop, props.muted, props.armed]);

  useEffect(() => {
    if (swapLock.current) return;
    primeBuffers(props.url);
  }, [props.preloadUrls.join("|"), props.url, front]);

  useEffect(() => {
    const current = visible();
    if (!current || !props.armed) return;
    void playLayer(current, props.muted, props.loop);
  }, [props.armed, props.muted, props.loop, front]);

  useEffect(() => {
    let frame = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const video = visible();
      if (video && video.readyState >= 2) {
        const remaining = video.duration - video.currentTime;
        if (!Number.isFinite(remaining) || remaining <= 1.2) holdFrame(video);
        if (shouldPrerollSwap(video.currentTime, video.duration)) {
          finishCurrent(video, true);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [front, props.armed, props.loop]);

  return (
    <>
      <canvas ref={canvasRef} className="frame-hold" aria-hidden="true" />
      {layers.map((ref, index) => (
        <video
          key={index}
          ref={ref}
          className={`layer${index === front ? " front" : " back"}`}
          playsInline
          muted
          preload="auto"
          crossOrigin="anonymous"
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (video === visible()) holdFrame(video);
            if (!shouldPrerollSwap(video.currentTime, video.duration)) return;
            finishCurrent(video, true);
          }}
          onEnded={(event) => {
            const video = event.currentTarget;
            holdFrame(video);
            if (video.loop) return;
            finishCurrent(video, true);
          }}
          onError={(event) => {
            const video = event.currentTarget;
            if (video !== visible()) return;
            holdFrame(video);
            fails.current += 1;
            if (fails.current < 3) {
              video.load();
              void video.play().catch(() => undefined);
              return;
            }
            fails.current = 0;
            propsRef.current.onFailed(video.dataset.cycle ?? props.cycleId, video.dataset.token ?? props.clipToken);
          }}
        />
      ))}
    </>
  );
}
