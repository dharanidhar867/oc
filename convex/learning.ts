// What a student has bought, and the lessons inside it. Lesson video URLs leave the server ONLY from here,
// and only after checking that the signed-in student has an enrollment for that course (written by payments.ts after a verified payment).
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
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
      const t = await loadTree(ctx, c._id, false, true);
      out.push({
        id: c._id as string,
        title: c.title,
        thumbnail: c.thumbnail,
        instructorName: c.instructorName,
        category: c.category,
        lessonCount: t.lessonCount,
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

/**
 * The course player's data, with playable lesson URLs. Returns null unless the caller owns the course,
 * with no hint whether the course exists. Buyers keep access even if the course is later unpublished ("lifetime access").
 */
export const getCourse = query({
  args: { token: v.optional(v.string()), courseId: v.string() },
  handler: async (ctx, { token, courseId }) => {
    const me = await viewerStudent(ctx, token);
    const id = ctx.db.normalizeId("submissions", courseId);
    if (!me || !id || !(await owns(ctx, me._id, id))) return null;
    const c = await ctx.db.get(id);
    if (!c) return null;
    const t = await loadTree(ctx, c._id, true, true); // URLs only for approved lessons, only for an owner
    return {
      id: c._id as string,
      title: c.title,
      instructorName: c.instructorName,
      sections: t.sections.map((s) => ({
        id: s.id,
        title: s.title,
        lessons: s.lessons.map((l) => ({ id: l.id, title: l.title, duration: l.duration, videoUrl: l.videoUrl })),
      })),
      lessonCount: t.lessonCount,
      totalSeconds: t.totalSeconds,
    };
  },
});
