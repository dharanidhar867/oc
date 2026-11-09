// Makes the value for the ADMIN_PASSCODE_HASH Convex env var. The passcode itself is never stored anywhere.
//   node scripts/hash-passcode.mjs
// then:  npx convex env set ADMIN_PASSCODE_HASH "<printed value>"      (add --prod for production)
import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 600_000;
const MIN_LENGTH = 12;

function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    let buf = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(buf);
        }
        if (c === "\u0003") process.exit(1);
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

const a = await askHidden(`Choose an admin passcode (at least ${MIN_LENGTH} characters; a few random words is ideal): `);
if (a.length < MIN_LENGTH) {
  console.error(`Too short: use at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
const b = await askHidden("Type it again: ");
if (a !== b) {
  console.error("They don't match.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = pbkdf2Sync(a, salt, ITERATIONS, 32, "sha256");
console.log(`\nADMIN_PASSCODE_HASH value:\n\npbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}\n`);
