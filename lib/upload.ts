// Browser-side helpers for sending a video straight to Convex storage.
// These limits only give instant feedback — Convex re-checks every one of them on the server.

import { toWebm } from "./convert";

export const MAX_VIDEO_MB = 200; // size of the converted WebM that gets stored
export const MAX_SOURCE_MB = 500; // largest MP4 we’ll try to convert in the browser
export const MAX_LESSON_MIN = 15;
export const MAX_PROMO_MIN = 2;

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Quick client-side check; returns an error message or null. */
export function videoProblem(f: File, maxSeconds: number, seconds: number): string | null {
  if (!["video/mp4", "video/webm"].includes(f.type)) return "Use an MP4 or WebM video.";
  const mb = f.size / 1048576;
  if (f.type === "video/webm" && mb > MAX_VIDEO_MB) return `That video is ${mb.toFixed(0)} MB — the limit is ${MAX_VIDEO_MB} MB.`;
  if (mb > MAX_SOURCE_MB) return `That video is ${mb.toFixed(0)} MB — please keep it under ${MAX_SOURCE_MB} MB.`;
  if (!(seconds > 0)) return "We couldn’t read that video. Try a different file.";
  if (seconds > maxSeconds) return `That video is ${fmtDuration(seconds)} long — the limit is ${Math.floor(maxSeconds / 60)} minutes.`;
  return null;
}

/** Reads the video's length in seconds from its metadata (nothing is uploaded). */
export function readDuration(f: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(n);
    };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/** POSTs the file to a Convex upload URL (with progress) and returns the storage id. */
export function uploadVideo(uploadUrl: string, f: File, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", uploadUrl);
    x.setRequestHeader("Content-Type", f.type);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      try {
        const { storageId } = JSON.parse(x.responseText);
        if (x.status >= 200 && x.status < 300 && storageId) return resolve(storageId);
      } catch {}
      reject(new Error("Upload failed. Please try again."));
    };
    x.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    x.send(f);
  });
}

/**
 * Converts to WebM (if needed), then uploads. The upload slot is only requested AFTER a successful
 * conversion, so a failed conversion never uses up the daily upload allowance.
 */
export async function convertAndUpload(file: File, seconds: number, getUploadUrl: () => Promise<string>, onStatus: (text: string) => void): Promise<string> {
  const webm = await toWebm(file, (p) => onStatus(p.phase === "loading" ? "Preparing converter…" : `Converting to WebM… ${p.pct}%`), seconds);
  if (webm.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`After conversion the video is ${(webm.size / 1048576).toFixed(0)} MB — the limit is ${MAX_VIDEO_MB} MB. Shorten the lesson or lower its quality.`);
  }
  const url = await getUploadUrl();
  return uploadVideo(url, webm, (n) => onStatus(`Uploading… ${n}%`));
}

/** Turns anything that can be thrown (Error, Convex error, plain string, ffmpeg object) into text a person can read. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  console.error("[quickai]", e);
  if (typeof e === "string" && e.trim()) return e.replace(/^Error:s*/, "");
  if (e && typeof e === "object") {
    const o = e as { data?: unknown; message?: unknown };
    if (typeof o.data === "string" && o.data) return o.data; // ConvexError from our own functions
    if (typeof o.message === "string" && o.message) return /Server Error|Uncaught/.test(o.message) ? fallback : o.message;
  }
  return fallback;
}
