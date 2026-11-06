// Sections and lesson videos. Instructor-only; every call re-checks that the course belongs to the caller.
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertEditable, ownCourse } from "./courses";
import { MAX_LESSONS_PER_COURSE, MAX_LESSON_SECONDS, MAX_SECTIONS_PER_COURSE } from "./limits";
import { deleteLessonFiles } from "./tree";
import { checkVideo } from "./uploads";

export const addSection = mutation({
  args: { token: v.string(), courseId: v.id("submissions"), title: v.string() },
  handler: async (ctx, { token, courseId, title }) => {
    const { course } = await ownCourse(ctx, token, courseId);
    assertEditable(course);
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
  args: { token: v.string(), sectionId: v.id("sections"), title: v.string(), videoId: v.id("_storage"), duration: v.number() },
  handler: async (ctx, a) => {
    const sec = await ctx.db.get(a.sectionId);
    if (!sec) throw new ConvexError("Section not found.");
    const { me, course } = await ownCourse(ctx, a.token, sec.courseId);
    assertEditable(course);
    const title = a.title.trim();
    if (title.length < 3 || title.length > 120) throw new ConvexError("Lesson title must be 3–120 characters.");

    const all = await ctx.db.query("lessons").withIndex("by_courseId", (q) => q.eq("courseId", course._id)).take(MAX_LESSONS_PER_COURSE + 1);
    if (all.length >= MAX_LESSONS_PER_COURSE) {
      await ctx.storage.delete(a.videoId);
      return { ok: false as const, error: `A course can have at most ${MAX_LESSONS_PER_COURSE} lessons.` };
    }
    const chk = await checkVideo(ctx, a.videoId);
    if (!chk.ok) return chk;
    if (!(a.duration > 0) || a.duration > MAX_LESSON_SECONDS) {
      await ctx.storage.delete(a.videoId);
      return { ok: false as const, error: "Each lesson must be 15 minutes or shorter. Split longer videos into several lessons." };
    }
    const inSection = all.filter((l) => l.sectionId === a.sectionId);
    await ctx.db.insert("lessons", {
      courseId: course._id,
      sectionId: a.sectionId,
      instructorId: me._id,
      title,
      order: Math.max(0, ...inSection.map((l) => l.order)) + 1,
      videoId: a.videoId,
      duration: Math.round(a.duration),
      size: chk.size,
      status: "pending",
    });
    await ctx.db.patch(course._id, { updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** Swap in a new video for a lesson (typically one an admin rejected). It goes back to "pending" for review. */
export const replaceLessonVideo = mutation({
  args: { token: v.string(), lessonId: v.id("lessons"), videoId: v.id("_storage"), duration: v.number() },
  handler: async (ctx, a) => {
    const lesson = await ctx.db.get(a.lessonId);
    if (!lesson) throw new ConvexError("Lesson not found.");
    const { course } = await ownCourse(ctx, a.token, lesson.courseId);
    assertEditable(course);
    const chk = await checkVideo(ctx, a.videoId);
    if (!chk.ok) return chk;
    if (!(a.duration > 0) || a.duration > MAX_LESSON_SECONDS) {
      await ctx.storage.delete(a.videoId);
      return { ok: false as const, error: "Each lesson must be 15 minutes or shorter." };
    }
    await ctx.storage.delete(lesson.videoId);
    await ctx.db.patch(lesson._id, { videoId: a.videoId, duration: Math.round(a.duration), size: chk.size, status: "pending", reason: undefined });
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
    assertEditable(course);
    await deleteLessonFiles(ctx, [lesson]);
    await ctx.db.patch(course._id, { updatedAt: Date.now() });
  },
});

