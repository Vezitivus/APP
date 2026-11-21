"use client";

import { useEffect, useRef, useState } from "react";
import {
  CROSSFADE_SECONDS,
  applyCrossfadeStyle,
  cloudinaryPlaybackUrl,
  crossfadeStyle,
  lastFrameTime,
  shouldPrerollSwap,
} from "@/lib/tv/playback";

function attrSrc(video: HTMLVideoElement | null): string | null {
  if (!video) return null;
  return video.getAttribute("src");
}

function sameSrc(video: HTMLVideoElement | null, url: string | null): boolean {
  return Boolean(url && attrSrc(video) === url);
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

function waitUntil(video: HTMLVideoElement, ok: () => boolean, events: string[], signal: { cancelled: boolean }): Promise<boolean> {
  if (ok()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      for (const event of events) video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      resolve(value);
    };
    let done = false;
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

function waitForFirstFrame(video: HTMLVideoElement, signal: { cancelled: boolean }): Promise<boolean> {
  const withFrame = () => !signal.cancelled && !video.paused && video.readyState >= 2;
  const rvfc = (
    video as HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number }
  ).requestVideoFrameCallback;
  if (typeof rvfc === "function") {
    return new Promise((resolve) => {
      const id = rvfc.call(video, () => resolve(!signal.cancelled));
      video.addEventListener(
        "error",
        () => {
          if (typeof video.cancelVideoFrameCallback === "function" && typeof id === "number") {
            video.cancelVideoFrameCallback(id);
          }
          resolve(false);
        },
        { once: true },
      );
    });
  }
  return waitUntil(video, withFrame, ["playing", "canplay", "loadeddata"], signal);
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
  preloadUrl: string | null;
  loop: boolean;
  muted: boolean;
  cycleId: string;
  clipToken: string;
  armed: boolean;
  onEnded: (cycleId: string, clipToken: string) => void;
  onFailed: (cycleId: string, clipToken: string) => void;
  onPlayBlocked?: () => void;
}) {
  const layers = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [front, setFront] = useState(0);
  const frontIndex = useRef(0);
  const swapLock = useRef(false);
  const reported = useRef<string | null>(null);
  const fails = useRef(0);
  const pendingUrl = useRef<string | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  frontIndex.current = front;

  const visible = () => layers[frontIndex.current].current;
  const hidden = () => layers[1 - frontIndex.current].current;

  function fill(video: HTMLVideoElement, src: string) {
    video.preload = "auto";
    video.playsInline = true;
    video.muted = true;
    if (attrSrc(video) === src) {
      if (video.readyState < 3) video.load();
      return;
    }
    video.setAttribute("src", src);
    video.load();
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

  function clearFadeStyles(video: HTMLVideoElement | null) {
    if (!video) return;
    video.style.opacity = "";
    video.style.filter = "";
    video.classList.remove("entering", "leaving");
  }

  function reportEnded(cycleId: string, clipToken: string) {
    const key = `${cycleId}:${clipToken}`;
    if (reported.current === key) return;
    reported.current = key;
    propsRef.current.onEnded(cycleId, clipToken);
  }

  async function overlap(outgoing: HTMLVideoElement, incomingUrl: string | null, signal: { cancelled: boolean }, report = true) {
    if (swapLock.current || signal.cancelled || outgoing !== visible()) return false;
    const incoming = hidden();
    const next = cloudinaryPlaybackUrl(incomingUrl);
    if (!incoming || !next || sameSrc(outgoing, next)) return false;
    swapLock.current = true;
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
            const onEnd = () => resolve(false);
            outgoing.addEventListener("ended", onEnd, { once: true });
            window.setTimeout(() => {
              outgoing.removeEventListener("ended", onEnd);
              resolve(ready());
            }, Math.max(40, remaining * 1000 + 30));
          }),
        ]);
      } else {
        ok = await waitReady;
      }
    }
    if (!ok || signal.cancelled) {
      if (outgoing.ended || (Number.isFinite(outgoing.duration) && outgoing.duration - outgoing.currentTime <= 0.04)) {
        freezeLastFrame(outgoing);
      }
      if (!ready()) {
        await waitUntil(incoming, ready, ["canplaythrough", "canplay", "loadeddata"], signal);
      }
    }
    if (signal.cancelled || incoming.readyState < 2) {
      swapLock.current = false;
      return false;
    }

    incoming.dataset.cycle = propsRef.current.cycleId;
    incoming.dataset.token = propsRef.current.clipToken;
    incoming.loop = propsRef.current.loop;
    const started = await playLayer(incoming, true, propsRef.current.loop);
    if (!started || signal.cancelled) {
      swapLock.current = false;
      return false;
    }
    const framed = await waitForFirstFrame(incoming, signal);
    if (!framed) {
      swapLock.current = false;
      return false;
    }
    if (propsRef.current.armed) incoming.muted = propsRef.current.muted;
    await runCrossfade(incoming, outgoing, signal);
    freezeLastFrame(outgoing);
    outgoing.muted = true;
    outgoing.loop = false;
    const index = incoming === layers[0].current ? 0 : 1;
    incoming.classList.remove("back", "entering", "leaving");
    incoming.classList.add("front");
    outgoing.classList.remove("front", "entering", "leaving");
    outgoing.classList.add("back");
    applyCrossfadeStyle(incoming, 1, 0);
    applyCrossfadeStyle(outgoing, 0, 8);
    // Drop inline styles only after the class already matches, so CSS cannot flash black.
    incoming.style.opacity = "";
    incoming.style.filter = "";
    outgoing.style.opacity = "";
    outgoing.style.filter = "";
    frontIndex.current = index;
    setFront(index);
    if (propsRef.current.armed) incoming.muted = propsRef.current.muted;
    swapLock.current = false;
    fails.current = 0;
    if (report) reportEnded(cycleId, clipToken);
    const queued = pendingUrl.current;
    pendingUrl.current = null;
    if (queued && !sameSrc(visible(), cloudinaryPlaybackUrl(queued))) {
      const shown = visible();
      if (shown) void overlap(shown, queued, { cancelled: false }, false);
    }
    return true;
  }

  useEffect(() => {
    const signal = { cancelled: false };
    const desired = cloudinaryPlaybackUrl(props.url);
    const current = visible();
    const buffer = hidden();
    if (!current || !buffer) return () => {
      signal.cancelled = true;
    };

    void (async () => {
      if (!desired) {
        if (current.getAttribute("src")) freezeLastFrame(current);
        return;
      }
      current.loop = props.loop;
      current.dataset.cycle = props.cycleId;
      current.dataset.token = props.clipToken;
      if (sameSrc(current, desired)) {
        pendingUrl.current = null;
        if (props.armed || props.muted) await playLayer(current, props.muted || !props.armed, props.loop);
        if (props.armed) current.muted = props.muted;
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
        await waitForFirstFrame(current, signal);
        if (props.armed) current.muted = props.muted;
        return;
      }
      await overlap(current, desired, signal, false);
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [props.url, props.cycleId, props.clipToken, props.loop, props.muted, props.armed]);

  useEffect(() => {
    const buffer = hidden();
    const next = cloudinaryPlaybackUrl(props.preloadUrl);
    if (!buffer || !next || swapLock.current) return;
    if (sameSrc(visible(), next) || sameSrc(buffer, next)) return;
    fill(buffer, next);
  }, [props.preloadUrl, props.url, front]);

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
      if (video && !video.loop && !swapLock.current) {
        if (shouldPrerollSwap(video.currentTime, video.duration, CROSSFADE_SECONDS)) {
          void overlap(video, propsRef.current.preloadUrl, { cancelled: false }, true);
          frame = requestAnimationFrame(tick);
          return;
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
      {[0, 1].map((index) => (
        <video
          key={index}
          ref={layers[index]}
          className={`layer${index === front ? " front" : " back"}`}
          playsInline
          muted
          preload="auto"
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (video !== visible() || video.loop || swapLock.current) return;
            if (!shouldPrerollSwap(video.currentTime, video.duration, CROSSFADE_SECONDS)) return;
            void overlap(video, propsRef.current.preloadUrl, { cancelled: false }, true);
          }}
          onEnded={(event) => {
            const video = event.currentTarget;
            if (video.loop) return;
            if (video === visible() && !swapLock.current) {
              freezeLastFrame(video);
              void overlap(video, propsRef.current.preloadUrl ?? propsRef.current.url, { cancelled: false }, true);
              return;
            }
            freezeLastFrame(video);
          }}
          onError={(event) => {
            const video = event.currentTarget;
            if (video !== visible()) return;
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
