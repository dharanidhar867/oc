// Helpers to load / delete a course's sections + lessons. Not a public API.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { MAX_LESSONS_PER_COURSE, MAX_SECTIONS_PER_COURSE } from "./limits";
import { discardVideo } from "./uploads";

/** Sections with their lessons, in order. Never includes video URLs: those come only from video.play, after an access check. */
export async function loadTree(ctx: QueryCtx, courseId: Id<"submissions">, approvedOnly = false) {
  const sections = await ctx.db.query("sections").withIndex("by_courseId", (q) => q.eq("courseId", courseId)).take(MAX_SECTIONS_PER_COURSE + 5);
  const lessons = await ctx.db.query("lessons").withIndex("by_courseId", (q) => q.eq("courseId", courseId)).take(MAX_LESSONS_PER_COURSE + 5);
  const out = [];
  for (const s of sections.sort((a, b) => a.order - b.order)) {
    const ls = [];
    for (const l of lessons.filter((x) => x.sectionId === s._id && (!approvedOnly || x.status === "approved")).sort((a, b) => a.order - b.order)) {
      ls.push({
        id: l._id as string,
        title: l.title,
        order: l.order,
        duration: l.duration,
        size: l.size,
        status: l.status,
        reason: l.reason,
        hasVideo: !!(l.assetId || l.videoId),
      });
    }
    if (approvedOnly && ls.length === 0) continue; // a section with nothing approved yet isn't shown to students
    out.push({ id: s._id as string, title: s.title, order: s.order, lessons: ls });
  }
  const all = out.flatMap((s) => s.lessons);
  return {
    sections: out,
    lessonCount: all.length,
    totalSeconds: all.reduce((n, l) => n + l.duration, 0),
    approved: all.filter((l) => l.status === "approved").length,
    pending: all.filter((l) => l.status === "pending").length,
    rejected: all.filter((l) => l.status === "rejected").length,
  };
}

export async function deleteLessonFiles(ctx: MutationCtx, lessons: Doc<"lessons">[]) {
  for (const l of lessons) {
    await discardVideo(ctx, l);
    await ctx.db.delete(l._id);
  }
}

/** Removes a course and everything under it, including the stored video files. */
export async function deleteCourse(ctx: MutationCtx, course: Doc<"submissions">) {
  const lessons = await ctx.db.query("lessons").withIndex("by_courseId", (q) => q.eq("courseId", course._id)).take(MAX_LESSONS_PER_COURSE + 5);
  await deleteLessonFiles(ctx, lessons);
  const sections = await ctx.db.query("sections").withIndex("by_courseId", (q) => q.eq("courseId", course._id)).take(MAX_SECTIONS_PER_COURSE + 5);
  for (const s of sections) await ctx.db.delete(s._id);
  const inCarts = await ctx.db.query("cartItems").withIndex("by_courseId", (q) => q.eq("courseId", course._id)).take(500);
  for (const c of inCarts) await ctx.db.delete(c._id);
  await discardVideo(ctx, { assetId: course.promoAssetId, videoId: course.promoVideoId });
  await ctx.db.delete(course._id);
}
