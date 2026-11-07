// Orders and payments. Security rules:
//  - The browser never sends a price or total: everything is recomputed here from live course prices.
//  - Card numbers never touch this app or Convex. The provider's hosted fields collect them (PCI scope stays with the provider).
//  - Only internal functions (webhook-driven) can mark an order paid; no public function can.
//  - Every public function needs a valid session, and orders are only visible to their owner.
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { owns } from "./learning";
import { MIN_PRICE_INR } from "./limits";
import { getViewer, rateLimit, requireRole, sha256Hex } from "./model";

const MAX_CART = 50;
const ORDER_TTL_MS = 30 * 60 * 1000;
const ORDERS_PER_HOUR = 10;
const CHECKOUTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
const CURRENCY = "inr";

const toCents = (price: number) => Math.round(price * 100);

/** Re-reads the cart and live prices. Unpublished courses and your own courses are dropped, never charged. */
async function priceCart(ctx: MutationCtx, userId: Id<"users">) {
  const rows = await ctx.db.query("cartItems").withIndex("by_userId", (q) => q.eq("userId", userId)).take(MAX_CART);
  const items: { courseId: Id<"submissions">; title: string; cents: number }[] = [];
  for (const r of rows) {
    const c = await ctx.db.get(r.courseId);
    if (!c || c.status !== "live" || c.instructorId === userId) continue;
    if (await owns(ctx, userId, c._id)) continue; // already bought: never charge twice
    const cents = toCents(c.price);
    if (!Number.isSafeInteger(cents) || cents < 0) continue;
    items.push({ courseId: c._id, title: c.title, cents });
  }
  items.sort((a, b) => (a.courseId < b.courseId ? -1 : 1));
  return items;
}

/** Turns the cart into a pending order (or reuses the identical one still open). Returns the order id to pay for. */
export const createOrder = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await requireRole(ctx, token, "student");
    const items = await priceCart(ctx, me._id);
    if (items.length === 0) return { ok: false as const, error: "Your cart is empty." };
    // The payment provider charges a minimum of ₹49; a smaller total would be charged ₹49 and never match the order.
    if (items.reduce((n, i) => n + i.cents, 0) < MIN_PRICE_INR * 100) {
      return { ok: false as const, error: `The minimum order is ₹${MIN_PRICE_INR}. Add another course to check out.` };
    }

    const now = Date.now();
    const cartHash = await sha256Hex(items.map((i) => `${i.courseId}:${i.cents}`).join("|"));
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_userId_and_cartHash", (q) => q.eq("userId", me._id).eq("cartHash", cartHash))
      .order("desc")
      .first();
    if (existing && existing.status === "pending" && existing.expiresAt > now) return { ok: true as const, orderId: existing._id as string };

    const recent = await ctx.db
      .query("orders")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", me._id).gte("createdAt", now - HOUR_MS))
      .take(ORDERS_PER_HOUR + 1);
    if (recent.length >= ORDERS_PER_HOUR) return { ok: false as const, error: "Too many checkout attempts. Please wait a little and try again." };

    // Older open orders for a different cart are superseded.
    const latest = await ctx.db.query("orders").withIndex("by_userId_and_createdAt", (q) => q.eq("userId", me._id)).order("desc").take(20);
    for (const o of latest) if (o.status === "pending") await ctx.db.patch(o._id, { status: "canceled" });

    const orderId = await ctx.db.insert("orders", {
      userId: me._id,
      items,
      totalCents: items.reduce((n, i) => n + i.cents, 0),
      currency: CURRENCY,
      status: "pending",
      cartHash,
      createdAt: now,
      expiresAt: now + ORDER_TTL_MS,
    });
    return { ok: true as const, orderId: orderId as string };
  },
});

/** The owner's view of one order. Anyone else (or a bad id) gets null, with no hint which. */
export const getOrder = query({
  args: { token: v.optional(v.string()), orderId: v.string() },
  handler: async (ctx, { token, orderId }) => {
    const me = await getViewer(ctx, token);
    if (!me || me.status === "suspended" || me.role !== "student") return null;
    const id = ctx.db.normalizeId("orders", orderId);
    const o = id ? await ctx.db.get(id) : null;
    if (!o || o.userId !== me._id) return null;
    const expired = o.status === "pending" && o.expiresAt <= Date.now();
    return {
      id: o._id as string,
      status: expired ? ("expired" as const) : o.status,
      currency: o.currency,
      totalCents: o.totalCents,
      items: o.items.map((i) => ({ courseId: i.courseId as string, title: i.title, cents: i.cents })),
      expiresAt: o.expiresAt,
    };
  },
});

export const cancelOrder = mutation({
  args: { token: v.string(), orderId: v.id("orders") },
  handler: async (ctx, { token, orderId }) => {
    const me = await requireRole(ctx, token, "student");
    const o = await ctx.db.get(orderId);
    if (!o || o.userId !== me._id) throw new ConvexError("Order not found.");
    if (o.status === "pending") await ctx.db.patch(orderId, { status: "canceled" });
  },
});

/** INTERNAL: the caller's own order (any status), or null. Used by the payment actions. */
export const ownedOrder = internalQuery({
  args: { token: v.string(), orderId: v.id("orders") },
  handler: async (ctx, { token, orderId }) => {
    const me = await requireRole(ctx, token, "student");
    const o = await ctx.db.get(orderId);
    return o && o.userId === me._id ? o : null;
  },
});

/**
 * INTERNAL: call from the payment provider's webhook handler, after verifying its signature.
 * Re-checks the provider-reported amount and currency against the order. Not reachable from the browser.
 * Idempotent: webhooks are delivered more than once.
 */
export const markPaid = internalMutation({
  args: { orderId: v.id("orders"), providerRef: v.string(), paidCents: v.number(), currency: v.string() },
  handler: async (ctx, { orderId, providerRef, paidCents, currency }) => {
    const o = await ctx.db.get(orderId);
    if (!o) throw new ConvexError("Order not found.");
    await settle(ctx, o, providerRef, paidCents, currency);
  },
});

/** Marks an order paid after re-checking the amount and currency. Safe to call twice (webhooks repeat). */
async function settle(ctx: MutationCtx, o: Doc<"orders">, paymentId: string, paidCents: number, currency: string) {
  if (o.status === "paid" || o.status === "refunded") return; // a late/retried success webhook must never re-grant a refunded order
  if (paidCents !== o.totalCents || currency.toLowerCase() !== o.currency) throw new ConvexError("Amount mismatch.");
  await ctx.db.patch(o._id, { status: "paid", paymentId, paidAt: Date.now() });
  for (const i of o.items) {
    const row = await ctx.db
      .query("cartItems")
      .withIndex("by_userId_and_courseId", (q) => q.eq("userId", o.userId).eq("courseId", i.courseId))
      .first();
    if (row) await ctx.db.delete(row._id);
  }
  for (const i of o.items) {
    const has = await ctx.db
      .query("enrollments")
      .withIndex("by_userId_and_courseId", (q) => q.eq("userId", o.userId).eq("courseId", i.courseId))
      .first();
    if (!has) await ctx.db.insert("enrollments", { userId: o.userId, courseId: i.courseId, orderId: o._id, createdAt: Date.now() });
  }
}

/** INTERNAL: finds the order a gateway payment belongs to, by checkout session id first, then by our own order id. */
export const findOrder = internalQuery({
  args: { providerRef: v.optional(v.string()), orderId: v.optional(v.string()), paymentId: v.optional(v.string()) },
  handler: async (ctx, { providerRef, orderId, paymentId }) => {
    if (providerRef) {
      const o = await ctx.db.query("orders").withIndex("by_providerRef", (q) => q.eq("providerRef", providerRef)).first();
      if (o) return o;
    }
    if (paymentId) {
      const o = await ctx.db.query("orders").withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId)).first();
      if (o) return o;
    }
    const id = orderId ? ctx.db.normalizeId("orders", orderId) : null;
    return id ? await ctx.db.get(id) : null;
  },
});

/** INTERNAL: per-buyer limit on opening payment pages (each one is a call to the payment provider). */
export const allowCheckoutAttempt = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await rateLimit(ctx, `checkout:${userId}`, CHECKOUTS_PER_HOUR, HOUR_MS),
});

/** INTERNAL: remembers the gateway's checkout session for an order. */
export const setCheckout = internalMutation({
  args: { orderId: v.id("orders"), providerRef: v.string(), checkoutUrl: v.string() },
  handler: async (ctx, { orderId, providerRef, checkoutUrl }) => {
    await ctx.db.patch(orderId, { providerRef, checkoutUrl });
  },
});

/** INTERNAL: a full refund took the money back, so the courses are taken back too. Safe to call twice. */
export const markRefunded = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const o = await ctx.db.get(orderId);
    if (!o || o.status !== "paid") return;
    await ctx.db.patch(orderId, { status: "refunded" });
    const rows = await ctx.db.query("enrollments").withIndex("by_orderId", (q) => q.eq("orderId", orderId)).take(MAX_CART);
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
