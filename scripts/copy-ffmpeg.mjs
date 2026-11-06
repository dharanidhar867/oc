// Copies the in-browser video converter (ffmpeg.wasm, single-threaded) into /public/ffmpeg.
// Served from our own origin so no third-party CDN is involved. Output is git-ignored.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";

const lib = "node_modules/@ffmpeg/ffmpeg/dist/esm";
const core = "node_modules/@ffmpeg/core/dist/esm";
if (!existsSync(lib) || !existsSync(core)) {
  console.warn("copy-ffmpeg: @ffmpeg packages missing — run npm install");
  process.exit(0);
}
mkdirSync("public/ffmpeg/esm", { recursive: true });
for (const f of readdirSync(lib).filter((n) => n.endsWith(".js"))) cpSync(`${lib}/${f}`, `public/ffmpeg/esm/${f}`);
cpSync(`${core}/ffmpeg-core.js`, "public/ffmpeg/ffmpeg-core.js");
cpSync(`${core}/ffmpeg-core.wasm`, "public/ffmpeg/ffmpeg-core.wasm");
