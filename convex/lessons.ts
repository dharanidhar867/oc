// Sections and lesson videos. Instructor-only; every call re-checks that the course belongs to the caller.
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { assertCanAdd, assertEditable, ownCourse } from "./courses";
import { MAX_LESSONS_PER_COURSE, MAX_LESSON_SECONDS, MAX_SECTIONS_PER_COURSE } from "./limits";
import { deleteLessonFiles } from "./tree";
import { claimAsset, discardVideo } from "./uploads";

/** Lessons are freely changeable in a draft. In a live course only lessons students can't see yet (pending/rejected) may be changed. */
function assertLessonChangeable(course: Doc<"submissions">, lesson: Doc<"lessons">) {
  if (course.status === "live" && lesson.status !== "approved") return;
  assertEditable(course);
}

export const addSection = mutation({
  args: { token: v.string(), courseId: v.id("submissions"), title: v.string() },
  handler: async (ctx, { token, courseId, title }) => {
    const { course } = await ownCourse(ctx, token, courseId);
    assertCanAdd(course);
    const t = title.trim();
    if (t.length < 2 || t.length > 100) throw new ConvexError("Section title must be 2–100 characters.");
    const existing = await ctx.db.query("sections").withIndex("by_courseId", (q) => q.eq("courseId", courseId)).take(MAX_SECTIONS_PER_COURSE + 1);
    if (existing.length >= MAX_SECTIONS_PER_COURSE) throw new ConvexError(`A course can have at most ${MAX_SECTIONS_PER_COURSE} sections.`);
    await ctx.db.insert("sections", { courseId, title: t, order: Math.max(0, ...existing.map((s) => s.order)) + 1 });
    await ctx.db.patch(courseId, { updatedAt: Date.now() });
  },
});

export const removeSection = mutation({
  args: { token: v.string(), sectionId: v.id("sections") },
  handler: async (ctx, { token, sectionId }) => {
    const sec = await ctx.db.get(sectionId);
    if (!sec) throw new ConvexError("Section not found.");
    const { course } = await ownCourse(ctx, token, sec.courseId);
    assertEditable(course);
    const lessons = await ctx.db.query("lessons").withIndex("by_sectionId", (q) => q.eq("sectionId", sectionId)).take(MAX_LESSONS_PER_COURSE);
    await deleteLessonFiles(ctx, lessons);
    await ctx.db.delete(sectionId);
    await ctx.db.patch(course._id, { updatedAt: Date.now() });
  },
});

export const addLesson = mutation({
  args: { token: v.string(), sectionId: v.id("sections"), title: v.string(), assetId: v.string(), size: v.number(), duration: v.number() },
  handler: async (ctx, a) => {
    const sec = await ctx.db.get(a.sectionId);
    if (!sec) throw new ConvexError("Section not found.");
    const { me, course } = await ownCourse(ctx, a.token, sec.courseId);
    assertCanAdd(course);
    const title = a.title.trim();
    if (title.length < 3 || title.length > 120) throw new ConvexError("Lesson title must be 3–120 characters.");

    const all = await ctx.db.query("lessons").withIndex("by_courseId", (q) => q.eq("courseId", course._id)).take(MAX_LESSONS_PER_COURSE + 1);
    if (all.length >= MAX_LESSONS_PER_COURSE) {
      await discardVideo(ctx, { assetId: a.assetId });
      return { ok: false as const, error: `A course can have at most ${MAX_LESSONS_PER_COURSE} lessons.` };
    }
    if (!(a.duration > 0) || a.duration > MAX_LESSON_SECONDS) {
      await discardVideo(ctx, { assetId: a.assetId });
      return { ok: false as const, error: "Each lesson must be 15 minutes or shorter. Split longer videos into several lessons." };
    }
    const chk = await claimAsset(ctx, a.assetId, me._id, "lesson", a.size);
    if (!chk.ok) return chk;
    const inSection = all.filter((l) => l.sectionId === a.sectionId);
    await ctx.db.insert("lessons", {
      courseId: course._id,
      sectionId: a.sectionId,
      instructorId: me._id,
      title,
      order: Math.max(0, ...inSection.map((l) => l.order)) + 1,
      assetId: a.assetId,
      duration: Math.round(a.duration),
      size: a.size,
      status: "pending",
    });
    await ctx.db.patch(course._id, { updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** Swap in a new video for a lesson (typically one an admin rejected). It goes back to "pending" for review. */
export const replaceLessonVideo = mutation({
  args: { token: v.string(), lessonId: v.id("lessons"), assetId: v.string(), size: v.number(), duration: v.number() },
  handler: async (ctx, a) => {
    const lesson = await ctx.db.get(a.lessonId);
    if (!lesson) throw new ConvexError("Lesson not found.");
    const { me, course } = await ownCourse(ctx, a.token, lesson.courseId);
    assertLessonChangeable(course, lesson);
    if (!(a.duration > 0) || a.duration > MAX_LESSON_SECONDS) {
      await discardVideo(ctx, { assetId: a.assetId });
      return { ok: false as const, error: "Each lesson must be 15 minutes or shorter." };
    }
    const chk = await claimAsset(ctx, a.assetId, me._id, "lesson", a.size);
    if (!chk.ok) return chk;
    await discardVideo(ctx, lesson); // the old video (Gumlet or legacy Convex file)
    await ctx.db.patch(lesson._id, { assetId: a.assetId, videoId: undefined, duration: Math.round(a.duration), size: a.size, status: "pending", reason: undefined });
    await ctx.db.patch(course._id, { updatedAt: Date.now() });
    return { ok: true as const };
  },
});

export const removeLesson = mutation({
  args: { token: v.string(), lessonId: v.id("lessons") },
  handler: async (ctx, { token, lessonId }) => {
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new ConvexError("Lesson not found.");
    const { course } = await ownCourse(ctx, token, lesson.courseId);
    assertLessonChangeable(course, lesson);
    await deleteLessonFiles(ctx, [lesson]);
    await ctx.db.patch(course._id, { updatedAt: Date.now() });
  },
});

