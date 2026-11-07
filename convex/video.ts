// The ONLY place a playable video link is created. Nothing else returns video URLs to the browser.
//
// Every link is a Gumlet *signed* embed URL: HMAC-SHA1 over the path + expiry with the collection's signing secret.
// Once the expiry passes Gumlet refuses to play it, so a copied link stops working within minutes.
// With referrer whitelisting on in Gumlet, links also only play when embedded on our own site.
// Lesson links can carry the viewer's email as a dynamic watermark (GUMLET_WATERMARK=on), so a screen recording is traceable.
//
// Convex env vars: GUMLET_SIGNING_SECRET (base64, from the collection's Video Protection → Signed URL), GUMLET_WATERMARK (optional, "on").
// Without GUMLET_SIGNING_SECRET nothing plays: we fail closed rather than hand out permanent links.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { owns } from "./learning";
import { getViewer, rateLimit } from "./model";
import { PLAYER_BASE } from "./uploads";

const MIN_TTL_S = 20 * 60;
const MAX_TTL_S = 60 * 60;
const PLAYS_PER_HOUR = 120; // per signed-in user; normal watching is far below this, link harvesting is not
const HOUR_MS = 60 * 60 * 1000;

type Result = { ok: true; url: string; expiresAt: number } | { ok: false; error: string };
const deny = (error = "You don’t have access to this video."): Result => ({ ok: false, error });

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

/** Gumlet signed embed URL, per Gumlet's docs: sign "<path>[?query]&signed_expires=<exp>" and append signed_token + signed_expires. */
async function signedEmbed(assetId: string, ttlSeconds: number, watermark?: string): Promise<{ url: string; expiresAt: number } | null> {
  if (!/^[A-Za-z0-9]+$/.test(assetId)) return null;
  const secret = process.env.GUMLET_SIGNING_SECRET;
  if (!secret) {
    // TESTING ONLY (Gumlet plan without Signed URLs): GUMLET_ALLOW_UNSIGNED=testing hands out plain links that never expire.
    // Access checks still apply, but a copied link keeps working. Never set this on the production deployment.
    if (process.env.GUMLET_ALLOW_UNSIGNED === "testing") {
      return { url: `${PLAYER_BASE}${assetId}`, expiresAt: Date.now() + ttlSeconds * 1000 };
    }
    console.error("[video] GUMLET_SIGNING_SECRET is not set: refusing to hand out unsigned video links");
    return null;
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const base = new URL(PLAYER_BASE);
  let path = `${base.pathname}${assetId}`;
  if (watermark) path += `?watermark_text=${encodeURIComponent(watermark)}`;
  const sep = path.includes("?") ? "&" : "?";
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const token = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${path}${sep}signed_expires=${exp}`)));
  return { url: `${base.origin}${path}${sep}signed_token=${token}&signed_expires=${exp}`, expiresAt: exp * 1000 };
}

const ttlFor = (seconds: number) => Math.min(MAX_TTL_S, Math.max(MIN_TTL_S, Math.ceil(seconds) + MIN_TTL_S));

/** Legacy videos stored in Convex have permanent URLs that can't be signed: only staff (owner / admin) may still see them. */
async function legacyUrl(ctx: MutationCtx, v: { videoId?: Doc<"lessons">["videoId"] }, staff: boolean): Promise<Result> {
  if (!staff || !v.videoId) return deny("This video is being updated. Please check back soon.");
  const url = await ctx.storage.getUrl(v.videoId);
  return url ? { ok: true, url, expiresAt: Date.now() + MAX_TTL_S * 1000 } : deny("Video not found.");
}

/**
 * Returns a short-lived playable link, after checking the caller may watch:
 *  - promo: anyone if the course is live; otherwise only its instructor or an admin.
 *  - lesson: an admin; the course's own (approved) instructor; or a student who bought the course (approved lessons only).
 * A mutation (not a query) so each link is fresh, rate-limited and never cached/re-sent to other subscribers.
 */
export const play = mutation({
  args: { token: v.optional(v.string()), kind: v.union(v.literal("lesson"), v.literal("promo")), id: v.string() },
  handler: async (ctx, { token, kind, id }): Promise<Result> => {
    const me = await getViewer(ctx, token);
    const viewer = me && me.status !== "suspended" ? me : null;
    const isAdmin = viewer?.role === "admin";
    const isInstructorOf = (c: Doc<"submissions">) => viewer?.role === "instructor" && viewer.status === "approved" && c.instructorId === viewer._id;

    if (kind === "promo") {
      const cid = ctx.db.normalizeId("submissions", id);
      const c = cid ? await ctx.db.get(cid) : null;
      if (!c) return deny();
      const staff = isAdmin || isInstructorOf(c);
      if (c.status !== "live" && !staff) return deny();
      // The promo is a free public preview, so an old Convex-stored promo may be shown to anyone allowed to see it
      // (a permanent link to a free preview costs nothing). Paid lessons never get this exception.
      if (!c.promoAssetId) return legacyUrl(ctx, { videoId: c.promoVideoId }, true);
      const s = await signedEmbed(c.promoAssetId, ttlFor(c.promoDuration ?? 0));
      return s ? { ok: true, ...s } : deny("Video playback isn’t available right now.");
    }

    // Lessons always need a signed-in, non-suspended user.
    if (!viewer) return deny("Please log in to watch this lesson.");
    const lid = ctx.db.normalizeId("lessons", id);
    const lesson = lid ? await ctx.db.get(lid) : null;
    const course = lesson ? await ctx.db.get(lesson.courseId) : null;
    if (!lesson || !course) return deny();

    const staff = isAdmin || isInstructorOf(course);
    const buyer = !staff && viewer.role === "student" && lesson.status === "approved" && (await owns(ctx, viewer._id, course._id));
    if (!staff && !buyer) return deny(); // same answer for "no such lesson" and "not yours": no probing

    if (!(await rateLimit(ctx, `play:${viewer._id}`, PLAYS_PER_HOUR, HOUR_MS))) {
      return deny("You’ve opened a lot of videos in a short time. Please wait a few minutes and try again.");
    }

    if (buyer) {
      // Remember where the student is, for "continue where you left off".
      const p = await ctx.db
        .query("lessonProgress")
        .withIndex("by_userId_and_lessonId", (q) => q.eq("userId", viewer._id).eq("lessonId", lesson._id))
        .unique();
      if (p) await ctx.db.patch(p._id, { lastWatchedAt: Date.now() });
      else await ctx.db.insert("lessonProgress", { userId: viewer._id, courseId: course._id, lessonId: lesson._id, lastWatchedAt: Date.now() });
    }

    if (!lesson.assetId) return legacyUrl(ctx, lesson, staff);
    const watermark = buyer && process.env.GUMLET_WATERMARK === "on" ? viewer.email : undefined;
    const s = await signedEmbed(lesson.assetId, ttlFor(lesson.duration), watermark);
    return s ? { ok: true, ...s } : deny("Video playback isn’t available right now.");
  },
});
