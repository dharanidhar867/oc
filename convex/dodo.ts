// Dodo Payments. The browser asks for a payment page; Dodo collects the card on its own hosted page,
// so card numbers never touch this app. Orders are only marked paid from the signed webhook, and only after
// the payment is re-fetched from Dodo's API with our secret key and its amount/currency match the order.
//
// Convex env vars: DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_SECRET, DODO_PAYMENTS_ENVIRONMENT (test_mode | live_mode),
// DODO_PRODUCT_ID (one pay-what-you-want product), SITE_URL.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";

const baseUrl = () => (process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com");

async function dodo(path: string, init?: { method: "POST"; body: unknown }) {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) throw new ConvexError("Payments are not configured.");
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(`Dodo ${path} failed with ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const urlProtocol = (s: string) => {
  try {
    return new URL(s).protocol;
  } catch {
    return null;
  }
};

/** SITE_URL as an origin, only if it is HTTPS (plain HTTP allowed for localhost testing). Otherwise null. */
function siteOrigin(): string | null {
  try {
    const u = new URL(process.env.SITE_URL ?? "");
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol === "https:" || (u.protocol === "http:" && local)) return u.origin;
    console.error("[dodo] SITE_URL must be an https:// URL: refusing to send buyers back over plain HTTP");
  } catch {}
  return null;
}

/** Creates a new hosted payment page for the caller's own pending order and returns its URL. */
export const startCheckout = action({
  args: { token: v.string(), orderId: v.id("orders") },
  handler: async (ctx, { token, orderId }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const order = await ctx.runQuery(internal.payments.ownedOrder, { token, orderId });
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status !== "pending" || order.expiresAt <= Date.now()) return { ok: false, error: "This checkout session is no longer active." };
    // Always a fresh Dodo session: an old one may hold a failed/abandoned attempt and would only show that result again.
    // A payment on an older session still finds this order through metadata.order_id.
    if (!(await ctx.runMutation(internal.payments.allowCheckoutAttempt, { userId: order.userId }))) {
      return { ok: false, error: "Too many payment attempts. Please wait a few minutes and try again." };
    }

    const productId = process.env.DODO_PRODUCT_ID;
    const site = siteOrigin();
    if (!productId || !site) return { ok: false, error: "Payments are not configured yet." };
    if (order.totalCents <= 0) return { ok: false, error: "Nothing to pay for." };

    try {
      const s = await dodo("/checkouts", {
        method: "POST",
        body: {
          // The amount comes from the server's own copy of the order, never from the browser.
          product_cart: [{ product_id: productId, quantity: 1, amount: order.totalCents }],
          metadata: { order_id: orderId },
          return_url: `${site}/checkout/${orderId}`,
        },
      });
      // The browser navigates straight to this, so only ever an https:// page (never javascript: or another scheme).
      const url = typeof s.checkout_url === "string" && urlProtocol(s.checkout_url) === "https:" ? s.checkout_url : null;
      const sessionId = typeof s.session_id === "string" ? s.session_id : null;
      if (!url || !sessionId) return { ok: false, error: "Could not start the payment. Please try again." };
      await ctx.runMutation(internal.payments.setCheckout, { orderId, providerRef: sessionId, checkoutUrl: url });
      return { ok: true, url };
    } catch (e) {
      console.error("startCheckout", e);
      return { ok: false, error: "Could not start the payment. Please try again." };
    }
  },
});

const str = (x: unknown) => (typeof x === "string" && x ? x : undefined);

/**
 * INTERNAL: called by the verified webhook route. Throwing makes the route answer 500, so Dodo retries.
 * Problems that a retry cannot fix (unknown order, amount mismatch) are logged and swallowed.
 */
export const handleEvent = internalAction({
  args: { type: v.string(), data: v.any() },
  handler: async (ctx, { type, data }): Promise<void> => {
    const d = (data ?? {}) as Record<string, unknown>;
    const paymentId = str(d.payment_id);
    if (!paymentId) return;

    if (type === "payment.succeeded") {
      // Never trust the webhook body for money: ask Dodo directly.
      const p = await dodo(`/payments/${encodeURIComponent(paymentId)}`);
      if (p.status !== "succeeded") return;
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      const order: Doc<"orders"> | null = await ctx.runQuery(internal.payments.findOrder, { providerRef: str(p.checkout_session_id), orderId: str(meta.order_id) });
      if (!order) return console.error("Dodo payment for unknown order", paymentId);
      if (order.status === "paid" && order.paymentId !== paymentId) {
        // Buyer paid twice for one order (e.g. two tabs). Access is already granted; the extra payment needs a refund in the Dodo dashboard.
        return console.error("DUPLICATE PAYMENT, refund it in Dodo", { orderId: order._id, paymentId, firstPaymentId: order.paymentId });
      }
      try {
        await ctx.runMutation(internal.payments.markPaid, {
          orderId: order._id,
          providerRef: paymentId,
          paidCents: Number(p.total_amount),
          currency: String(p.currency ?? ""),
        });
      } catch (e) {
        // Money was taken but didn't match the order, so no access was granted. Refund it in the Dodo dashboard.
        console.error("PAYMENT NOT APPLIED (amount/currency mismatch), REFUND IT IN DODO", {
          paymentId,
          orderId: order._id,
          expected: `${order.totalCents} ${order.currency}`,
          charged: `${String(p.total_amount)} ${String(p.currency)}`,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return;
    }

    if (type === "refund.succeeded") {
      const order = await ctx.runQuery(internal.payments.findOrder, { paymentId });
      if (!order) return;
      // Only a full refund takes the courses back. Partial refunds are left for a human to decide.
      const amount = d.amount === undefined ? undefined : Number(d.amount);
      if (amount === undefined || amount >= order.totalCents) await ctx.runMutation(internal.payments.markRefunded, { orderId: order._id });
      else console.error("Partial refund, not revoking access", paymentId, amount);
    }
    // payment.failed / cancelled / processing: the order stays pending and the buyer can retry on the same page until it expires.
  },
});
