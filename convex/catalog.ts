// PUBLIC read-only catalog of courses an admin has approved. No login needed.
// Deliberately returns no lesson video URLs — only the free promo, titles and lengths.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { loadTree } from "./tree";

export const listLive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("submissions").withIndex("by_status", (q) => q.eq("status", "live")).take(200);
    const out = [];
    for (const s of rows) {
      const t = await loadTree(ctx, s._id, false);
      out.push({
        id: s._id as string,
        title: s.title,
        subtitle: s.subtitle,
        category: s.category,
        level: s.level,
        price: s.price,
        thumbnail: s.thumbnail,
        instructorName: s.instructorName,
        lessonCount: t.lessonCount,
        totalSeconds: t.totalSeconds,
        publishedAt: s.updatedAt,
      });
    }
    return out.sort((a, b) => b.publishedAt - a.publishedAt);
  },
});

export const getLive = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const cid = ctx.db.normalizeId("submissions", id);
    const s = cid && (await ctx.db.get(cid));
    if (!s || s.status !== "live") return null;
    const t = await loadTree(ctx, s._id, false); // no video URLs
    return {
      id: s._id as string,
      title: s.title,
      subtitle: s.subtitle,
      description: s.description,
      category: s.category,
      level: s.level,
      price: s.price,
      thumbnail: s.thumbnail,
      instructorName: s.instructorName,
      promoUrl: s.promoVideoId ? await ctx.storage.getUrl(s.promoVideoId) : null,
      sections: t.sections.map((sec) => ({ id: sec.id, title: sec.title, lessons: sec.lessons.map((l) => ({ id: l.id, title: l.title, duration: l.duration })) })),
      lessonCount: t.lessonCount,
      totalSeconds: t.totalSeconds,
    };
  },
});
