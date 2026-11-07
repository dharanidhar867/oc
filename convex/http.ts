// Public HTTP endpoints. Gumlet tells us here when a video finishes processing (or fails).
// Authenticated with the shared secret Gumlet sends in the x-gumlet-token header (GUMLET_WEBHOOK_SECRET).
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

http.route({
  path: "/gumlet/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.GUMLET_WEBHOOK_SECRET;
    if (!secret || !sameSecret(req.headers.get("x-gumlet-token") ?? "", secret)) return new Response("unauthorized", { status: 401 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return new Response("bad request", { status: 400 });
    const assetId = [body.asset_id, body.video_id, body.id].find((x) => typeof x === "string") as string | undefined;
    const event = String(body.event ?? body.type ?? body.status ?? "").toLowerCase();
    if (assetId) {
      if (/error|fail/.test(event)) await ctx.runMutation(internal.uploads.setAssetStatus, { assetId, status: "errored" });
      else if (/ready/.test(event)) await ctx.runMutation(internal.uploads.setAssetStatus, { assetId, status: "ready" });
    }
    return new Response("ok", { status: 200 });
  }),
});

/** Standard Webhooks check: HMAC-SHA256 of "id.timestamp.body" with the whsec_ key. Returns the raw body if genuine, else null. */
async function verifyDodo(req: Request, secret: string): Promise<string | null> {
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sig = req.headers.get("webhook-signature");
  if (!id || !ts || !sig) return null;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return null;
  const body = await req.text();
  try {
    const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
    const expected = btoa(String.fromCharCode(...mac));
    for (const part of sig.split(" ")) {
      const [ver, s] = part.split(",");
      if (ver === "v1" && s && sameSecret(s, expected)) return body;
    }
  } catch {
    return null;
  }
  return null;
}

http.route({
  path: "/dodo/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    if (!secret) return new Response("not configured", { status: 500 });
    const body = await verifyDodo(req, secret);
    if (body === null) return new Response("unauthorized", { status: 401 });
    let evt: { type?: unknown; data?: unknown };
    try {
      evt = JSON.parse(body);
    } catch {
      return new Response("bad request", { status: 400 });
    }
    if (typeof evt.type !== "string") return new Response("bad request", { status: 400 });
    try {
      await ctx.runAction(internal.dodo.handleEvent, { type: evt.type, data: evt.data ?? {} });
    } catch (e) {
      console.error("dodo webhook", e);
      return new Response("error", { status: 500 }); // Dodo retries
    }
    return new Response("ok", { status: 200 });
  }),
});

export default http;
