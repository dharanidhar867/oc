// Instructor-only course workflow. The owner is always taken from the session, never from client input.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { CATS } from "../lib/data";
import { MAX_PROMO_SECONDS, MIN_COURSE_SECONDS, MIN_LESSONS } from "./limits";
import { requireRole } from "./model";
import { deleteCourse, loadTree } from "./tree";
import { claimAsset, discardVideo, watchUrl } from "./uploads";

const shape = (s: Doc<"submissions">) => ({ ...s, id: s._id as string, instructorId: s.instructorId as string });

export const listMine = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (!token) return [];
    const me = await requireRole(ctx, token, "instructor");
    const rows = await ctx.db.query("submissions").withIndex("by_instructorId", (q) => q.eq("instructorId", me._id)).take(200);
    const out = [];
    for (const s of rows) {
      const t = await loadTree(ctx, s._id, false);
      out.push({ ...shape(s), lessonCount: t.lessonCount, totalSeconds: t.totalSeconds, rejectedLessons: t.rejected });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export async function ownCourse(ctx: QueryCtx, token: string, id: Id<"submissions">) {
  const me = await requireRole(ctx, token, "instructor");
  const s = await ctx.db.get(id);
  if (!s || s.instructorId !== me._id) throw new ConvexError("Course not found."); // same message for "not yours" — no probing
  return { me, course: s };
}

/** Content can only be changed while the course is a draft or was sent back; never while under review or live. */
export function assertEditable(course: Doc<"submissions">) {
  if (course.status !== "draft" && course.status !== "rejected") throw new ConvexError("Withdraw this course from review before editing its lessons.");
}

/** New sections and lessons can also be added to a live course. They stay hidden from students until an admin approves them. */
export function assertCanAdd(course: Doc<"submissions">) {
  if (course.status !== "draft" && course.status !== "rejected" && course.status !== "live") throw new ConvexError("Withdraw this course from review before editing its lessons.");
}

/** Full course for the owner's editor, including playable lesson URLs. */
export const get = query({
  args: { token: v.optional(v.string()), id: v.id("submissions") },
  handler: async (ctx, { token, id }) => {
    if (!token) return null;
    const { course } = await ownCourse(ctx, token, id);
    const tree = await loadTree(ctx, id, true);
    return { ...shape(course), promoUrl: await watchUrl(ctx, { assetId: course.promoAssetId, videoId: course.promoVideoId }), ...tree };
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    subtitle: v.string(),
    category: v.string(),
    level: v.string(),
    price: v.number(),
    description: v.string(),
    thumbnail: v.string(),
    promoAssetId: v.string(),
    promoSize: v.number(),
    promoDuration: v.number(),
  },
  handler: async (ctx, a) => {
    const me = await requireRole(ctx, a.token, "instructor");
    const title = a.title.trim(), subtitle = a.subtitle.trim(), description = a.description.trim();
    if (title.length < 5 || title.length > 120) throw new ConvexError("Title must be 5–120 characters.");
    if (subtitle.length > 200) throw new ConvexError("Subtitle is too long.");
    if (description.length < 60 || description.length > 5000) throw new ConvexError("Description must be 60–5000 characters.");
    if (!Number.isFinite(a.price) || a.price < 0 || a.price > 100000) throw new ConvexError("Enter a valid price.");
    if (!CATS.some((c) => c.name === a.category)) throw new ConvexError("Choose a category from the list."); // the course is listed under this catalog category
    if (a.level.length > 30) throw new ConvexError("Invalid level.");
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(a.thumbnail) || a.thumbnail.length > 700_000) throw new ConvexError("Upload a smaller course image (PNG, JPEG or WebP).");

    if (!(a.promoDuration > 0) || a.promoDuration > MAX_PROMO_SECONDS) {
      await discardVideo(ctx, { assetId: a.promoAssetId });
      return { ok: false as const, error: "The promo video must be 2 minutes or shorter." };
    }
    const v1 = await claimAsset(ctx, a.promoAssetId, me._id, "promo", a.promoSize);
    if (!v1.ok) return v1;
    const id = await ctx.db.insert("submissions", {
      instructorId: me._id,
      instructorName: me.name,
      title,
      subtitle,
      category: a.category,
      level: a.level,
      price: Math.round(a.price * 100) / 100,
      description,
      thumbnail: a.thumbnail,
      promoAssetId: a.promoAssetId,
      promoDuration: Math.round(a.promoDuration),
      status: "draft", // lessons are added next, then the course is submitted for review
      updatedAt: Date.now(),
    });
    return { ok: true as const, id: id as string };
  },
});

export const submitForReview = mutation({
  args: { token: v.string(), id: v.id("submissions") },
  handler: async (ctx, { token, id }) => {
    const { course } = await ownCourse(ctx, token, id);
    assertEditable(course);
    const t = await loadTree(ctx, id, false);
    if (t.lessonCount < MIN_LESSONS) throw new ConvexError(`Add at least ${MIN_LESSONS} lesson before submitting.`);
    if (t.totalSeconds < MIN_COURSE_SECONDS) throw new ConvexError(`Lessons must total at least ${MIN_COURSE_SECONDS / 60} minutes (you have ${Math.floor(t.totalSeconds / 60)}).`);
    if (t.sections.some((s) => s.lessons.length === 0)) throw new ConvexError("Remove or fill any empty sections first.");
    if (t.rejected > 0) throw new ConvexError("Replace the rejected lesson videos before resubmitting.");
    await ctx.db.patch(id, { status: "in_review", reason: undefined, updatedAt: Date.now() });
  },
});

export const backToDraft = mutation({
  args: { token: v.string(), id: v.id("submissions") },
  handler: async (ctx, { token, id }) => {
    const { course } = await ownCourse(ctx, token, id);
    if (course.status !== "in_review" && course.status !== "rejected") throw new ConvexError("This course can't be moved back to draft.");
    await ctx.db.patch(id, { status: "draft", updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("submissions") },
  handler: async (ctx, { token, id }) => {
    const { course } = await ownCourse(ctx, token, id);
    if (course.status === "live" || course.status === "in_review") throw new ConvexError("Withdraw this course before deleting it.");
    await deleteCourse(ctx, course);
  },
});
