// Converts an MP4 (or any browser-readable video) to WebM (VP8 + Vorbis, max 720p / 480p for long lessons) inside the browser
// using ffmpeg.wasm, served from /public/ffmpeg (same origin). The server only accepts WebM.

type FFmpegInstance = {
  load: (o: { coreURL: string; wasmURL: string }) => Promise<boolean>;
  on: (e: "progress" | "log", cb: (d: { progress?: number; message?: string }) => void) => void;
  writeFile: (n: string, d: Uint8Array) => Promise<boolean>;
  readFile: (n: string) => Promise<Uint8Array | string>;
  deleteFile: (n: string) => Promise<boolean>;
  exec: (args: string[]) => Promise<number>;
  terminate: () => void;
};
// Loaded at runtime straight from /public (not bundled) so the library can start its own module worker.
const importRuntime = new Function("u", "return import(u)") as (u: string) => Promise<{ FFmpeg: new () => FFmpegInstance }>;

export type ConvertPhase = { phase: "loading" } | { phase: "converting"; pct: number };

/** WebM files are used as-is. Anything else is re-encoded to WebM. */
export async function toWebm(file: File, onPhase?: (p: ConvertPhase) => void, seconds = 0): Promise<File> {
  if (file.type === "video/webm") return file;

  onPhase?.({ phase: "loading" });
  const base = window.location.origin + "/ffmpeg/";
  const { FFmpeg } = await importRuntime(base + "esm/index.js").catch(() => {
    throw new Error("Couldn’t prepare your video. Refresh the page and try again.");
  });
  const ff = new FFmpeg();
  const tail: string[] = []; // last ffmpeg log lines, to explain a failure
  try {
    ff.on("log", ({ message }) => {
      if (message) tail.push(message);
      if (tail.length > 12) tail.shift();
    });
    await ff.load({ coreURL: base + "ffmpeg-core.js", wasmURL: base + "ffmpeg-core.wasm" });
    ff.on("progress", ({ progress }) => onPhase?.({ phase: "converting", pct: Math.max(0, Math.min(100, Math.round((progress ?? 0) * 100))) }));
    onPhase?.({ phase: "converting", pct: 0 });
    await ff.writeFile("input", new Uint8Array(await file.arrayBuffer()));
    // This encoder’s output is roughly 1–2 Mbit/s whatever the bitrate flags say, so keep long lessons under the
    // 200 MB cap by lowering the resolution: 720p up to 8 min, 480p beyond. Never upscale.
    const cap = seconds > 8 * 60 ? 480 : 720;
    const code = await ff.exec([
      "-i", "input",
      "-vf", `scale=-2:'min(${cap},ih)'`,
      "-c:v", "libvpx", "-b:v", "800k",
      "-deadline", "realtime", "-cpu-used", "8",
      // Vorbis, not Opus: the Opus encoder in this ffmpeg.wasm build crashes ("memory access out of bounds") on larger files.
      "-c:a", "libvorbis", "-b:a", "80k",
      "-f", "webm", "out.webm",
    ]);
    if (code !== 0) throw new Error("We couldn’t process that video. Try exporting it again as a standard MP4.");
    const out = (await ff.readFile("out.webm")) as Uint8Array;
    const bytes = new Uint8Array(out.byteLength);
    bytes.set(out); // copy into a plain ArrayBuffer-backed array
    return new File([bytes], file.name.replace(/\.[^.]+$/, "") + ".webm", { type: "video/webm" });
  } catch (e) {
    console.error("[quickai] conversion failed", e, tail.join("\n"));
    const why = tail.filter((l) => /error|invalid|unsupported|not found|fail/i.test(l)).slice(-2).join(" ");
    const base = e instanceof Error ? e.message : typeof e === "string" ? e : "";
    throw new Error((base || "We couldn’t process that video.") + (why ? ` (${why})` : ""));
  } finally {
    ff.terminate();
  }
}
