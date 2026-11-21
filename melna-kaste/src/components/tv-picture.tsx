"use client";

import { useEffect, useRef, useState } from "react";
import { cloudinaryPlaybackUrl, lastFrameTime, shouldPrerollSwap } from "@/lib/tv/playback";

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
      rvfc.call(video, () => resolve(!signal.cancelled));
      video.addEventListener("error", () => resolve(false), { once: true });
    });
  }
  return waitUntil(video, withFrame, ["playing", "canplay", "loadeddata"], signal);
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
  const propsRef = useRef(props);
  propsRef.current = props;
  frontIndex.current = front;

  const visible = () => layers[frontIndex.current].current;
  const hidden = () => layers[1 - frontIndex.current].current;

  function fill(video: HTMLVideoElement, src: string) {
    video.preload = "auto";
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
      if (!muted) propsRef.current.onPlayBlocked?.();
      return false;
    }
  }

  async function reveal(incoming: HTMLVideoElement, outgoing: HTMLVideoElement, signal: { cancelled: boolean }) {
    if (swapLock.current || signal.cancelled || incoming === outgoing) return false;
    swapLock.current = true;
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
    incoming.muted = propsRef.current.muted;
    incoming.loop = propsRef.current.loop;
    freezeLastFrame(outgoing);
    outgoing.muted = true;
    const index = incoming === layers[0].current ? 0 : 1;
    frontIndex.current = index;
    setFront(index);
    swapLock.current = false;
    return true;
  }

  function reportEnded(cycleId: string, clipToken: string) {
    const key = `${cycleId}:${clipToken}`;
    if (reported.current === key) return;
    reported.current = key;
    propsRef.current.onEnded(cycleId, clipToken);
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
        current.pause();
        return;
      }
      current.loop = props.loop;
      current.dataset.cycle = props.cycleId;
      current.dataset.token = props.clipToken;
      if (sameSrc(current, desired)) {
        if (props.armed) await playLayer(current, props.muted, props.loop);
        return;
      }
      if (!sameSrc(buffer, desired)) fill(buffer, desired);
      buffer.dataset.cycle = props.cycleId;
      buffer.dataset.token = props.clipToken;
      const ready = await waitUntil(buffer, () => buffer.readyState >= 3, ["canplaythrough", "canplay", "loadeddata"], signal);
      if (!ready || signal.cancelled) return;
      await reveal(buffer, current, signal);
      if (props.armed && !props.muted) {
        const shown = visible();
        if (shown) shown.muted = props.muted;
      }
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [props.url, props.cycleId, props.clipToken, props.loop, props.muted, props.armed]);

  useEffect(() => {
    const buffer = hidden();
    const next = cloudinaryPlaybackUrl(props.preloadUrl);
    if (!buffer || !next) return;
    if (sameSrc(visible(), next)) return;
    fill(buffer, next);
  }, [props.preloadUrl, props.url, front]);

  useEffect(() => {
    const current = visible();
    if (!current || !props.armed) return;
    void playLayer(current, props.muted, props.loop);
  }, [props.armed, props.muted, props.loop, front]);

  async function swapFromFront(source: HTMLVideoElement) {
    if (source.loop) return;
    if (source !== visible()) return;
    freezeLastFrame(source);
    const cycleId = source.dataset.cycle ?? propsRef.current.cycleId;
    const clipToken = source.dataset.token ?? propsRef.current.clipToken;
    const buffer = hidden();
    const next = cloudinaryPlaybackUrl(propsRef.current.preloadUrl);
    if (buffer && next && sameSrc(buffer, next) && buffer.readyState >= 2) {
      const swapped = await reveal(buffer, source, { cancelled: false });
      if (swapped) {
        reportEnded(cycleId, clipToken);
        return;
      }
    }
    reportEnded(cycleId, clipToken);
  }

  return (
    <>
      {[0, 1].map((index) => (
        <video
          key={index}
          ref={layers[index]}
          className={`layer${index === front ? " front" : " back"}`}
          playsInline
          preload="auto"
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (video !== visible() || video.loop) return;
            if (!shouldPrerollSwap(video.currentTime, video.duration)) return;
            void swapFromFront(video);
          }}
          onEnded={(event) => {
            const video = event.currentTarget;
            if (video.loop) return;
            void swapFromFront(video);
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
