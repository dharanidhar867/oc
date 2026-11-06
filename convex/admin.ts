// Admin-only functions. Every one re-checks the caller's role on the server.
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { MIN_COURSE_SECONDS, MIN_LESSONS } from "./limits";
import { requireRole } from "./model";
import { deleteCourse, loadTree } from "./tree";

const audit = (ctx: MutationCtx, admin: string, action: string, target: string) =>
  ctx.db.insert("audit", { at: Date.now(), admin, action, target });

const cleanReason = (r: string | undefined) => {
  const t = (r ?? "").trim();
  if (t.length < 3 || t.length > 500) throw new ConvexError("Give a reason (3–500 characters).");
  return t;
};

export const listInstructors = query({
  args: { token: v.string(), status: v.optional(v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected"), v.literal("suspended"))) },
  handler: async (ctx, { token, status }) => {
    await requireRole(ctx, token, "admin");
    const rows = status
      ? await ctx.db.query("users").withIndex("by_role_and_status", (q) => q.eq("role", "instructor").eq("status", status)).take(500)
      : await ctx.db.query("users").withIndex("by_role_and_status", (q) => q.eq("role", "instructor")).take(500);
    // Never send password material to the browser.
    return rows
      .map((u) => ({ id: u._id as string, name: u.name, email: u.email, status: u.status, rejectionReason: u.rejectionReason, application: u.application, createdAt: u.createdAt }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const decideApplication = mutation({
  args: { token: v.string(), userId: v.id("users"), decision: v.union(v.literal("approved"), v.literal("rejected")), reason: v.optional(v.string()) },
  handler: async (ctx, { token, userId, decision, reason }) => {
    const admin = await requireRole(ctx, token, "admin");
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "instructor") throw new ConvexError("Instructor not found.");
    if (u.status === "suspended") throw new ConvexError("Reinstate this instructor first.");
    const why = decision === "rejected" ? cleanReason(reason) : undefined;
    await ctx.db.patch(userId, { status: decision, rejectionReason: why });
    await audit(ctx, admin.name, decision === "approved" ? "Approved instructor" : `Rejected instructor (${why})`, u.email);
  },
});

export const setSuspended = mutation({
  args: { token: v.string(), userId: v.id("users"), suspended: v.boolean() },
  handler: async (ctx, { token, userId, suspended }) => {
    const admin = await requireRole(ctx, token, "admin");
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "instructor") throw new ConvexError("Instructor not found.");
    await ctx.db.patch(userId, { status: suspended ? "suspended" : "approved" });
    if (suspended) {
      // Take all live courses offline and end their sessions immediately.
      const live = await ctx.db.query("submissions").withIndex("by_instructorId", (q) => q.eq("instructorId", userId)).take(500);
      for (const s of live) if (s.status === "live") await ctx.db.patch(s._id, { status: "taken_down", updatedAt: Date.now() });
      const sessions = await ctx.db.query("sessions").withIndex("by_userId", (q) => q.eq("userId", userId)).take(100);
      for (const s of sessions) await ctx.db.delete(s._id);
    }
    await audit(ctx, admin.name, suspended ? "Suspended instructor" : "Reinstated instructor", u.email);
  },
});

export const listSubmissions = query({
  args: { token: v.string(), status: v.union(v.literal("in_review"), v.literal("live")) },
  handler: async (ctx, { token, status }) => {
    await requireRole(ctx, token, "admin");
    const rows = await ctx.db.query("submissions").withIndex("by_status", (q) => q.eq("status", status)).take(200);
    const out = [];
    for (const s of rows) {
      const t = await loadTree(ctx, s._id, false);
      out.push({ ...s, id: s._id as string, instructorId: s.instructorId as string, lessonCount: t.lessonCount, approvedLessons: t.approved, totalSeconds: t.totalSeconds });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Everything an admin needs to review a course: promo + every lesson with a playable URL. */
export const getCourseForReview = query({
  args: { token: v.string(), id: v.id("submissions") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "admin");
    const course = await ctx.db.get(id);
    if (!course) return null;
    const tree = await loadTree(ctx, id, true);
    return { id: id as string, title: course.title, promoUrl: course.promoVideoId ? await ctx.storage.getUrl(course.promoVideoId) : null, ...tree };
  },
});

export const decideLesson = mutation({
  args: { token: v.string(), lessonId: v.id("lessons"), decision: v.union(v.literal("approved"), v.literal("rejected")), reason: v.optional(v.string()) },
  handler: async (ctx, { token, lessonId, decision, reason }) => {
    const admin = await requireRole(ctx, token, "admin");
    const l = await ctx.db.get(lessonId);
    const course = l && (await ctx.db.get(l.courseId));
    if (!l || !course || course.status !== "in_review") throw new ConvexError("This lesson isn’t awaiting review.");
    const why = decision === "rejected" ? cleanReason(reason) : undefined;
    await ctx.db.patch(lessonId, { status: decision, reason: why });
    await audit(ctx, admin.name, decision === "approved" ? "Approved lesson" : `Rejected lesson (${why})`, `${course.title} › ${l.title}`);
  },
});

export const decideCourse = mutation({
  args: { token: v.string(), id: v.id("submissions"), decision: v.union(v.literal("live"), v.literal("rejected")), reason: v.optional(v.string()) },
  handler: async (ctx, { token, id, decision, reason }) => {
    const admin = await requireRole(ctx, token, "admin");
    const s = await ctx.db.get(id);
    if (!s || s.status !== "in_review") throw new ConvexError("This course isn't awaiting review.");
    const why = decision === "rejected" ? cleanReason(reason) : undefined;
    if (decision === "live") {
      const t = await loadTree(ctx, id, false);
      if (t.lessonCount < MIN_LESSONS || t.totalSeconds < MIN_COURSE_SECONDS) throw new ConvexError("This course doesn’t meet the minimum content requirements.");
      if (t.approved !== t.lessonCount) throw new ConvexError("Review and approve every lesson before publishing.");
    }
    await ctx.db.patch(id, { status: decision, reason: why, updatedAt: Date.now() });
    await audit(ctx, admin.name, decision === "live" ? "Approved course" : `Rejected course (${why})`, s.title);
  },
});

export const takeDown = mutation({
  args: { token: v.string(), id: v.id("submissions"), reason: v.string() },
  handler: async (ctx, { token, id, reason }) => {
    const admin = await requireRole(ctx, token, "admin");
    const s = await ctx.db.get(id);
    if (!s || s.status !== "live") throw new ConvexError("This course isn't live.");
    const why = cleanReason(reason);
    await ctx.db.patch(id, { status: "taken_down", reason: why, updatedAt: Date.now() });
    await audit(ctx, admin.name, `Took down course (${why})`, s.title);
  },
});

export const listAudit = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireRole(ctx, token, "admin");
    const rows = await ctx.db.query("audit").withIndex("by_at").order("desc").take(200);
    return rows.map((a) => ({ id: a._id as string, at: a.at, admin: a.admin, action: a.action, target: a.target }));
  },
});
