// Video uploads go straight from the browser to Convex storage using a one-time upload URL.
// Only approved instructors get one, and lesson uploads are capped at 2 per rolling 24 hours.
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { DAY_MS, LESSON_UPLOADS_PER_DAY, MAX_VIDEO_BYTES, PROMO_UPLOADS_PER_DAY, VIDEO_TYPES } from "./limits";
import { requireRole } from "./model";

export const generateUploadUrl = mutation({
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
    await ctx.db.insert("uploadLog", { instructorId: me._id, kind, at: Date.now() });
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Checks a freshly uploaded file using what Convex itself measured (not what the browser claims).
 * A bad file is deleted. Callers must RETURN the error (not throw) so the deletion isn't rolled back.
 */
export async function checkVideo(ctx: MutationCtx, storageId: Id<"_storage">): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) return { ok: false, error: "Upload not found. Please try again." };
  const bad = (error: string) => ctx.storage.delete(storageId).then(() => ({ ok: false as const, error }));
  if (!meta.contentType || !VIDEO_TYPES.includes(meta.contentType)) return bad("Videos must be WebM (MP4s are converted automatically in the browser).");
  if (meta.size > MAX_VIDEO_BYTES) return bad("That video is over the 200 MB limit.");
  if (meta.size < 10_000) return bad("That file is too small to be a real video.");
  // A storage file may only ever be attached once (stops one instructor re-using another's file id).
  const usedAsLesson = await ctx.db.query("lessons").withIndex("by_videoId", (q) => q.eq("videoId", storageId)).first();
  const usedAsPromo = (await ctx.db.query("submissions").collect()).some((s) => s.promoVideoId === storageId);
  if (usedAsLesson || usedAsPromo) return { ok: false, error: "That upload is already in use." };
  return { ok: true, size: meta.size };
}
