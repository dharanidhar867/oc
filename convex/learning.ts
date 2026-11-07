// What a student has bought, the lessons inside it, and their progress. Ownership = an enrollment row,
// written only by payments.ts after a verified payment. Video links are NOT handed out here (see video.ts).
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { MAX_LESSONS_PER_COURSE } from "./limits";
import { getViewer } from "./model";
import { loadTree } from "./tree";

const MAX_OWNED = 500;

async function viewerStudent(ctx: QueryCtx, token: string | undefined) {
  const me = await getViewer(ctx, token);
  return me && me.status !== "suspended" && me.role === "student" ? me : null;
}

/** True if this student owns the course. Used by payments/cart so a course is never sold twice. */
export async function owns(ctx: QueryCtx, userId: Id<"users">, courseId: Id<"submissions">) {
  const row = await ctx.db
    .query("enrollments")
    .withIndex("by_userId_and_courseId", (q) => q.eq("userId", userId).eq("courseId", courseId))
    .first();
  return row !== null;
}

/** The signed-in student's purchased courses, newest purchase first. [] when logged out. */
export const myCourses = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await viewerStudent(ctx, token);
    if (!me) return [];
    const rows = await ctx.db.query("enrollments").withIndex("by_userId", (q) => q.eq("userId", me._id)).order("desc").take(MAX_OWNED);
    const out = [];
    for (const r of rows) {
      const c = await ctx.db.get(r.courseId);
      if (!c) continue; // course deleted by its instructor
      const t = await loadTree(ctx, c._id, true);
      const visible = new Set(t.sections.flatMap((s) => s.lessons.map((l) => l.id)));
      const completedCount = (await progressFor(ctx, me._id, c._id)).filter((p) => p.completedAt && visible.has(p.lessonId)).length;
      out.push({
        id: c._id as string,
        title: c.title,
        thumbnail: c.thumbnail,
        instructorName: c.instructorName,
        category: c.category,
        lessonCount: t.lessonCount,
        completedCount,
        totalSeconds: t.totalSeconds,
        purchasedAt: r.createdAt,
      });
    }
    return out;
  },
});

/** Whether the signed-in student owns a course. false for guests, instructors and admins. */
export const ownsCourse = query({
  args: { token: v.optional(v.string()), courseId: v.string() },
  handler: async (ctx, { token, courseId }) => {
    const me = await viewerStudent(ctx, token);
    const id = ctx.db.normalizeId("submissions", courseId);
    return !!me && !!id && (await owns(ctx, me._id, id));
  },
});

async function progressFor(ctx: QueryCtx, userId: Id<"users">, courseId: Id<"submissions">) {
  return await ctx.db
    .query("lessonProgress")
    .withIndex("by_userId_and_courseId", (q) => q.eq("userId", userId).eq("courseId", courseId))
    .take(MAX_LESSONS_PER_COURSE + 5);
}

/**
 * The course player's outline and the student's progress. NO video URLs: the player asks video.play for a short-lived signed link per lesson.
 * Returns null unless the caller owns the course, with no hint whether the course exists.
 * Buyers keep access even if the course is later unpublished ("lifetime access").
 */
export const getCourse = query({
  args: { token: v.optional(v.string()), courseId: v.string() },
  handler: async (ctx, { token, courseId }) => {
    const me = await viewerStudent(ctx, token);
    const id = ctx.db.normalizeId("submissions", courseId);
    if (!me || !id || !(await owns(ctx, me._id, id))) return null;
    const c = await ctx.db.get(id);
    if (!c) return null;
    const t = await loadTree(ctx, c._id, true); // approved lessons only
    const progress = await progressFor(ctx, me._id, c._id);
    const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId as string));
    const visible = new Set(t.sections.flatMap((s) => s.lessons.map((l) => l.id)));
    const last = progress.filter((p) => visible.has(p.lessonId)).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)[0];
    return {
      id: c._id as string,
      title: c.title,
      instructorName: c.instructorName,
      sections: t.sections.map((s) => ({
        id: s.id,
        title: s.title,
        lessons: s.lessons.map((l) => ({ id: l.id, title: l.title, duration: l.duration, completed: done.has(l.id) })),
      })),
      lessonCount: t.lessonCount,
      completedCount: [...visible].filter((lid) => done.has(lid)).length,
      resumeLessonId: last ? (last.lessonId as string) : null,
      totalSeconds: t.totalSeconds,
    };
  },
});

/** Marks a lesson done / not done for the signed-in student. Only for approved lessons of a course they own. */
export const setCompleted = mutation({
  args: { token: v.string(), lessonId: v.id("lessons"), completed: v.boolean() },
  handler: async (ctx, { token, lessonId, completed }) => {
    const me = await viewerStudent(ctx, token);
    if (!me) throw new ConvexError("Please log in.");
    const lesson = await ctx.db.get(lessonId);
    if (!lesson || lesson.status !== "approved" || !(await owns(ctx, me._id, lesson.courseId))) throw new ConvexError("Lesson not found.");
    const p = await ctx.db
      .query("lessonProgress")
      .withIndex("by_userId_and_lessonId", (q) => q.eq("userId", me._id).eq("lessonId", lessonId))
      .unique();
    const completedAt = completed ? Date.now() : undefined;
    if (p) await ctx.db.patch(p._id, { completedAt });
    else await ctx.db.insert("lessonProgress", { userId: me._id, courseId: lesson.courseId, lessonId, lastWatchedAt: Date.now(), completedAt });
  },
});
