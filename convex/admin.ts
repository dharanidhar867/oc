// Admin-only functions. Every one re-checks the caller's role on the server.
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { MIN_COURSE_SECONDS, MIN_LESSONS } from "./limits";
import {
  ADMIN_LOCK_MS,
  ADMIN_MAX_FAILURES,
  ADMIN_UNLOCK_MS,
  adminUnlocked,
  checkPasscode,
  getAdminUnlock,
  rateCount,
  rateLimit,
  requireAdmin,
  requireRole,
  sessionOf,
} from "./model";
import { deleteCourse, loadTree } from "./tree";

const audit = (ctx: MutationCtx, admin: string, action: string, target: string) =>
  ctx.db.insert("audit", { at: Date.now(), admin, action, target });

const cleanReason = (r: string | undefined) => {
  const t = (r ?? "").trim();
  if (t.length < 3 || t.length > 500) throw new ConvexError("Give a reason (3–500 characters).");
  return t;
};

/** Passcode-gate state for the console. Says "locked" to everyone who isn't an unlocked admin (reveals nothing). */
export const unlockStatus = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (!(await adminUnlocked(ctx, token))) return { unlocked: false as const };
    const u = await getAdminUnlock(ctx, token);
    return u ? { unlocked: true as const, expiresAt: u.expiresAt } : { unlocked: false as const };
  },
});

/**
 * Enter the admin passcode. It is checked here, on the server, against a hash held in the environment.
 * Wrong guesses are counted per admin account and site-wide; past the limit the gate locks for a while whatever is typed.
 * Returns (never throws) so that failed attempts are actually recorded.
 */
export const unlock = mutation({
  args: { token: v.string(), passcode: v.string() },
  handler: async (ctx, { token, passcode }): Promise<{ ok: true; expiresAt: number } | { ok: false; error: string }> => {
    const admin = await requireRole(ctx, token, "admin"); // must already be a signed-in, approved admin
    const session = await sessionOf(ctx, token);
    if (!session) return { ok: false, error: "Please log in again." };
    const key = `adminunlock:${admin._id}`;
    const globalKey = "adminunlock:global";
    if ((await rateCount(ctx, key, ADMIN_LOCK_MS)) >= ADMIN_MAX_FAILURES || (await rateCount(ctx, globalKey, ADMIN_LOCK_MS)) >= ADMIN_MAX_FAILURES * 4) {
      return { ok: false, error: "Too many wrong attempts. Try again in 30 minutes." };
    }
    const wrong = { ok: false as const, error: "Incorrect passcode." };
    if (passcode.length === 0 || passcode.length > 200) return wrong;
    const r = await checkPasscode(passcode);
    if (r === "not_configured") return { ok: false, error: "The admin passcode hasn't been set up on the server yet." };
    if (r === "wrong") {
      await rateLimit(ctx, key, Number.MAX_SAFE_INTEGER, ADMIN_LOCK_MS); // only counts
      await rateLimit(ctx, globalKey, Number.MAX_SAFE_INTEGER, ADMIN_LOCK_MS);
      await audit(ctx, admin.email, "passcode_failed", "admin console");
      return wrong;
    }
    const bucket = await ctx.db.query("rateBuckets").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (bucket) await ctx.db.delete(bucket._id);
    const old = await ctx.db.query("adminUnlocks").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).unique();
    if (old) await ctx.db.delete(old._id);
    const now = Date.now();
    const expiresAt = now + ADMIN_UNLOCK_MS;
    await ctx.db.insert("adminUnlocks", { sessionId: session._id, createdAt: now, expiresAt });
    await audit(ctx, admin.email, "console_unlocked", "admin console");
    return { ok: true, expiresAt };
  },
});

/** Lock the console again on this session (the login itself stays). */
export const lock = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await sessionOf(ctx, token);
    if (!session) return;
    const u = await ctx.db.query("adminUnlocks").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).unique();
    if (u) await ctx.db.delete(u._id);
  },
});

export const listInstructors = query({
  args: { token: v.string(), status: v.optional(v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected"), v.literal("suspended"))) },
  handler: async (ctx, { token, status }) => {
    await requireAdmin(ctx, token);
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
    const admin = await requireAdmin(ctx, token);
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
    const admin = await requireAdmin(ctx, token);
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
    await requireAdmin(ctx, token);
    const rows = await ctx.db.query("submissions").withIndex("by_status", (q) => q.eq("status", status)).take(200);
    const out = [];
    for (const s of rows) {
      const t = await loadTree(ctx, s._id);
      out.push({ ...s, id: s._id as string, instructorId: s.instructorId as string, lessonCount: t.lessonCount, approvedLessons: t.approved, pendingLessons: t.pending, totalSeconds: t.totalSeconds });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Everything an admin needs to review a course: promo + every lesson with a playable URL. */
export const getCourseForReview = query({
  args: { token: v.string(), id: v.id("submissions") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
    const course = await ctx.db.get(id);
    if (!course) return null;
    const tree = await loadTree(ctx, id);
    return { id: id as string, title: course.title, hasPromo: !!(course.promoAssetId || course.promoVideoId), ...tree };
  },
});

export const decideLesson = mutation({
  args: { token: v.string(), lessonId: v.id("lessons"), decision: v.union(v.literal("approved"), v.literal("rejected")), reason: v.optional(v.string()) },
  handler: async (ctx, { token, lessonId, decision, reason }) => {
    const admin = await requireAdmin(ctx, token);
    const l = await ctx.db.get(lessonId);
    const course = l && (await ctx.db.get(l.courseId));
    if (!l || !course || (course.status !== "in_review" && course.status !== "live")) throw new ConvexError("This lesson isn’t awaiting review.");
    const why = decision === "rejected" ? cleanReason(reason) : undefined;
    await ctx.db.patch(lessonId, { status: decision, reason: why });
    await audit(ctx, admin.name, decision === "approved" ? "Approved lesson" : `Rejected lesson (${why})`, `${course.title} › ${l.title}`);
  },
});

export const decideCourse = mutation({
  args: { token: v.string(), id: v.id("submissions"), decision: v.union(v.literal("live"), v.literal("rejected")), reason: v.optional(v.string()) },
  handler: async (ctx, { token, id, decision, reason }) => {
    const admin = await requireAdmin(ctx, token);
    const s = await ctx.db.get(id);
    if (!s || s.status !== "in_review") throw new ConvexError("This course isn't awaiting review.");
    const why = decision === "rejected" ? cleanReason(reason) : undefined;
    if (decision === "live") {
      const t = await loadTree(ctx, id);
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
    const admin = await requireAdmin(ctx, token);
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
    await requireAdmin(ctx, token);
    const rows = await ctx.db.query("audit").withIndex("by_at").order("desc").take(200);
    return rows.map((a) => ({ id: a._id as string, at: a.at, admin: a.admin, action: a.action, target: a.target }));
  },
});
