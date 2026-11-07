// Videos live on Gumlet, not in Convex. Flow:
//   1. the browser calls createUpload (instructors only, 2 lesson uploads per rolling 24 h),
//   2. we ask Gumlet for a one-time upload URL + asset id and remember who owns that asset,
//   3. the browser PUTs the file straight to Gumlet,
//   4. addLesson / courses.create "claim" the asset id (it must be ours, unused and not errored).
// Secrets (GUMLET_API_KEY, GUMLET_WORKSPACE_ID) are Convex environment variables — never sent to the browser.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalAction, internalMutation } from "./_generated/server";
import { DAY_MS, LESSON_UPLOADS_PER_DAY, MAX_VIDEO_BYTES, PROMO_UPLOADS_PER_DAY } from "./limits";
import { requireRole } from "./model";

const GUMLET_API = "https://api.gumlet.com/v1";
export const PLAYER_BASE = "https://play.gumlet.io/embed/";

/** URL students/admins watch a video at (Gumlet's hosted player; handles HLS in every browser). */
export const playerUrl = (assetId: string) => PLAYER_BASE + assetId;

function gumletEnv() {
  const key = process.env.GUMLET_API_KEY, workspace = process.env.GUMLET_WORKSPACE_ID;
  if (!key || !workspace) throw new ConvexError("Video uploads aren't set up yet. Please contact support.");
  return { key, workspace };
}

/** Checks the caller may upload, enforces the daily limit and records the slot. Returns the slot id so it can be refunded. */
export const reserveSlot = internalMutation({
  args: { token: v.string(), kind: v.union(v.literal("lesson"), v.literal("promo")) },
  handler: async (ctx, { token, kind }) => {
    const me = await requireRole(ctx, token, "instructor");
    const since = Date.now() - DAY_MS;
    const recent = await ctx.db
      .query("uploadLog")
      .withIndex("by_instructor_and_kind_and_at", (q) => q.eq("instructorId", me._id).eq("kind", kind).gt("at", since))
      .collect();
    const limit = kind === "lesson" ? LESSON_UPLOADS_PER_DAY : PROMO_UPLOADS_PER_DAY;
    if (recent.length >= limit) {
      const resets = Math.min(...recent.map((r) => r.at)) + DAY_MS;
      const hrs = Math.max(1, Math.ceil((resets - Date.now()) / 3_600_000));
      throw new ConvexError(`Daily limit reached: ${limit} ${kind} upload${limit > 1 ? "s" : ""} per day. Try again in about ${hrs} hour${hrs > 1 ? "s" : ""}.`);
    }
    const slotId = await ctx.db.insert("uploadLog", { instructorId: me._id, kind, at: Date.now() });
    return { instructorId: me._id, slotId };
  },
});

export const refundSlot = internalMutation({
  args: { slotId: v.id("uploadLog") },
  handler: async (ctx, { slotId }) => {
    await ctx.db.delete(slotId);
  },
});

export const recordAsset = internalMutation({
  args: { assetId: v.string(), instructorId: v.id("users"), kind: v.union(v.literal("lesson"), v.literal("promo")) },
  handler: async (ctx, a) => {
    await ctx.db.insert("videoAssets", { ...a, status: "uploading", used: false, createdAt: Date.now() });
  },
});

/** Step 1-2: returns a one-time Gumlet upload URL for the browser to PUT the video to. */
export const createUpload = action({
  args: { token: v.string(), kind: v.union(v.literal("lesson"), v.literal("promo")) },
  handler: async (ctx, { token, kind }): Promise<{ uploadUrl: string; assetId: string }> => {
    const { key, workspace } = gumletEnv();
    const { instructorId, slotId } = await ctx.runMutation(internal.uploads.reserveSlot, { token, kind });
    try {
      const res = await fetch(`${GUMLET_API}/video/assets/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspace, format: "ABR", keep_original: false }),
      });
      const body = (await res.json().catch(() => null)) as { upload_url?: string; asset_id?: string } | null;
      if (!res.ok || !body?.upload_url || !body.asset_id) throw new Error(`Gumlet ${res.status}`);
      await ctx.runMutation(internal.uploads.recordAsset, { assetId: body.asset_id, instructorId, kind });
      return { uploadUrl: body.upload_url, assetId: body.asset_id };
    } catch (e) {
      console.error("[gumlet] createUpload failed", e);
      await ctx.runMutation(internal.uploads.refundSlot, { slotId }); // a failed attempt doesn't use up the daily allowance
      throw new ConvexError("Couldn't start the upload. Please try again in a moment.");
    }
  },
});

/** Deletes a video from Gumlet (scheduled whenever a lesson/course is removed or its video replaced). */
export const deleteAsset = internalAction({
  args: { assetId: v.string() },
  handler: async (_ctx, { assetId }) => {
    const key = process.env.GUMLET_API_KEY;
    if (!key) return;
    const res = await fetch(`${GUMLET_API}/video/assets/${encodeURIComponent(assetId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok && res.status !== 404) console.error("[gumlet] delete failed", assetId, res.status);
  },
});

/** Called by the Gumlet webhook. Safe to repeat. */
export const setAssetStatus = internalMutation({
  args: { assetId: v.string(), status: v.union(v.literal("ready"), v.literal("errored")) },
  handler: async (ctx, { assetId, status }) => {
    const row = await ctx.db.query("videoAssets").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).first();
    if (row) await ctx.db.patch(row._id, { status });
  },
});

/** Watch URL for a stored video: Gumlet player for new uploads, Convex storage URL for legacy ones. */
export async function watchUrl(ctx: { storage: QueryCtx["storage"] }, v: { assetId?: string; videoId?: Id<"_storage"> }): Promise<string | null> {
  if (v.assetId) return playerUrl(v.assetId);
  return v.videoId ? await ctx.storage.getUrl(v.videoId) : null;
}

/** Removes whichever kind of stored video a lesson/course has: Gumlet asset (new) or Convex file (legacy). */
export async function discardVideo(ctx: MutationCtx, v: { assetId?: string; videoId?: Id<"_storage"> }) {
  if (v.assetId) {
    const row = await ctx.db.query("videoAssets").withIndex("by_assetId", (q) => q.eq("assetId", v.assetId!)).first();
    if (row) await ctx.db.delete(row._id);
    await ctx.scheduler.runAfter(0, internal.uploads.deleteAsset, { assetId: v.assetId });
  }
  if (v.videoId) await ctx.storage.delete(v.videoId);
}

/**
 * Validates an asset the browser says it uploaded and marks it used.
 * Callers must RETURN the error (not throw) so cleanup done here isn't rolled back.
 */
export async function claimAsset(
  ctx: MutationCtx,
  assetId: string,
  instructorId: Id<"users">,
  kind: "lesson" | "promo",
  size: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await ctx.db.query("videoAssets").withIndex("by_assetId", (q) => q.eq("assetId", assetId)).first();
  // Same message for "not found" and "not yours" — no probing of other people's uploads.
  if (!row || row.instructorId !== instructorId || row.kind !== kind) return { ok: false, error: "Upload not found. Please try again." };
  if (row.used) return { ok: false, error: "That upload is already in use." };
  if (row.status === "errored") {
    await discardVideo(ctx, { assetId });
    return { ok: false, error: "That video couldn’t be processed. Please try again or export it as a standard MP4." };
  }
  if (!Number.isFinite(size) || size < 10_000) {
    await discardVideo(ctx, { assetId });
    return { ok: false, error: "That file is too small to be a real video." };
  }
  if (size > MAX_VIDEO_BYTES) {
    await discardVideo(ctx, { assetId });
    return { ok: false, error: "That video is over the 200 MB limit." };
  }
  await ctx.db.patch(row._id, { used: true });
  return { ok: true };
}
