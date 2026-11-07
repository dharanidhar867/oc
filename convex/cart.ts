// The buyer's cart. Every function needs a valid login session; the server decides who may buy what.
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { owns } from "./learning";
import { getViewer, requireRole } from "./model";

const MAX_CART = 50;

/** The signed-in user's cart, with current course details. Returns [] when logged out (never an error, so the header can call it freely). */
export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await getViewer(ctx, token);
    if (!me || me.status === "suspended" || me.role !== "student") return []; // only students have a cart
    const rows = await ctx.db.query("cartItems").withIndex("by_userId", (q) => q.eq("userId", me._id)).take(MAX_CART);
    const out = [];
    for (const r of rows) {
      const c = await ctx.db.get(r.courseId);
      if (!c || c.status !== "live") continue; // unpublished since it was added: hidden (and not charged)
      const lessons = (await ctx.db.query("lessons").withIndex("by_courseId", (q) => q.eq("courseId", c._id)).take(105)).filter((l) => l.status === "approved");
      out.push({
        id: c._id as string,
        title: c.title,
        category: c.category,
        level: c.level,
        price: c.price,
        thumbnail: c.thumbnail,
        instructorName: c.instructorName,
        lessonCount: lessons.length,
        addedAt: r.addedAt,
      });
    }
    return out.sort((a, b) => b.addedAt - a.addedAt);
  },
});

export const add = mutation({
  args: { token: v.string(), courseId: v.id("submissions") },
  handler: async (ctx, { token, courseId }) => {
    const me = await requireRole(ctx, token, "student"); // only student accounts buy; instructors, admins and guests are rejected here
    const c = await ctx.db.get(courseId);
    if (!c || c.status !== "live") throw new ConvexError("This course isn’t available.");
    if (c.instructorId === me._id) throw new ConvexError("You can’t buy your own course.");
    if (await owns(ctx, me._id, courseId)) throw new ConvexError("You already own this course.");
    const have = await ctx.db.query("cartItems").withIndex("by_userId", (q) => q.eq("userId", me._id)).take(MAX_CART + 1);
    if (have.some((r) => r.courseId === courseId)) return;
    if (have.length >= MAX_CART) throw new ConvexError("Your cart is full.");
    await ctx.db.insert("cartItems", { userId: me._id, courseId, addedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { token: v.string(), courseId: v.id("submissions") },
  handler: async (ctx, { token, courseId }) => {
    const me = await requireRole(ctx, token, "student");
    const row = await ctx.db.query("cartItems").withIndex("by_userId_and_courseId", (q) => q.eq("userId", me._id).eq("courseId", courseId)).first();
    if (row) await ctx.db.delete(row._id);
  },
});

// Checkout lives in payments.ts (createOrder): the total is computed server-side from live prices.
