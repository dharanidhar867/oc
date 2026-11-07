// Browser-side helpers for sending a video straight to Gumlet.
// These limits only give instant feedback — the server re-checks what it can (see convex/uploads.ts).

export const MAX_VIDEO_MB = 200; // keep in step with MAX_VIDEO_BYTES in convex/limits.ts
export const MAX_LESSON_MIN = 15;
export const MAX_PROMO_MIN = 2;

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Quick client-side check; returns an error message or null. */
export function videoProblem(f: File, maxSeconds: number, seconds: number): string | null {
  if (!["video/mp4", "video/webm"].includes(f.type)) return "Please choose an MP4 video.";
  const mb = f.size / 1048576;
  if (mb > MAX_VIDEO_MB) return `That video is ${mb.toFixed(0)} MB — the limit is ${MAX_VIDEO_MB} MB.`;
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

/** PUTs the file to a Gumlet upload URL, reporting progress. */
export function uploadVideo(uploadUrl: string, f: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", uploadUrl);
    x.setRequestHeader("Content-Type", f.type || "video/mp4");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error("Upload failed. Please try again.")));
    x.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    x.send(f);
  });
}

/**
 * Asks the server for a Gumlet upload slot, then uploads. Gumlet converts the video itself, so there is no
 * processing in the browser. Returns what the server needs to attach the video to a lesson / course.
 */
export async function uploadToGumlet(file: File, getUpload: () => Promise<{ uploadUrl: string; assetId: string }>, onStatus: (text: string) => void) {
  onStatus("Starting upload…");
  const { uploadUrl, assetId } = await getUpload();
  await uploadVideo(uploadUrl, file, (n) => onStatus(`Uploading… ${n}%`));
  return { assetId, size: file.size };
}

/** Turns anything that can be thrown (Error, Convex error, plain string) into text a person can read. */
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
