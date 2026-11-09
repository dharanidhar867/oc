"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DISPLAY, MONO, T } from "@/lib/theme";
import { useAuth } from "../auth";
import { CheckoutSteps, Receipt, TrustList } from "../CheckoutParts";

const fmt = (paise: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(paise / 100);

const card = { background: "#fff", borderRadius: 30, padding: 26 } as const;

/**
 * Secure checkout. What is shown comes from the server's copy of the order, never from the browser.
 * Card details are NOT collected by this app: when a gateway is connected, its own payment window collects them,
 * so card numbers never touch our code or database.
 */
export default function CheckoutView({ orderId }: { orderId: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const order = useQuery(api.payments.getOrder, token ? { token, orderId } : "skip");
  const cancelM = useMutation(api.payments.cancelOrder);

  const cancel = async () => {
    if (token && order) await cancelM({ token, orderId: order.id as Id<"orders"> }).catch(() => {});
    router.push("/cart");
  };

  if (order === undefined) return <div style={{ minHeight: "60vh" }} />;

  if (order === null || order.status !== "pending") {
    const msg =
      order === null ? "We couldn’t find that order." :
      order.status === "paid" ? "Payment received — your courses are unlocked. 🎉" :
      order.status === "expired" ? "This checkout session expired. Your cart is still saved." :
      "This checkout session is no longer active.";
    const paid = order?.status === "paid";
    return (
      <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
      {paid && <CheckoutSteps current="done" />}
      {/* A paid order prints out as a receipt and gets stamped. */}
      <div className={paid ? "receipt" : undefined} style={{ ...card, textAlign: "center" }}>
        {paid && (
          <div style={{ marginBottom: 18 }}>
            <span className="paid-stamp">PAID</span>
          </div>
        )}
        {paid && order && (
          <div style={{ font: `400 13px/1.9 ${MONO}`, textAlign: "left", maxWidth: 420, margin: "0 auto 18px", borderTop: `2px dashed ${T.line}`, borderBottom: `2px dashed ${T.line}`, padding: "10px 0" }}>
            {order.items.map((i) => (
              <div key={i.courseId} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</span>
                <span>{fmt(i.cents, order.currency)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>TOTAL</span>
              <span>{fmt(order.totalCents, order.currency)}</span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 18, marginBottom: 18 }}>{msg}</div>
        <Link href={paid ? "/my-courses" : "/cart"} className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "13px 26px", borderRadius: 99, display: "inline-block" }}>
          {paid ? "Go to my courses" : "Back to cart"} <span className="arr">→</span>
        </Link>
      </div>
      </div>
    );
  }

  const total = fmt(order.totalCents, order.currency);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 40px 60px" }}>
      <h1 style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 6px" }}>Secure checkout</h1>
      <div style={{ color: T.muted2, marginBottom: 14 }}>Review your order and pay securely.</div>
      <CheckoutSteps current="pay" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 460px", ...card }}>
          <h2 style={{ font: `800 24px ${DISPLAY}`, margin: "0 0 16px" }}>Payment</h2>
          <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 18 }}>
            <div className="rc-lock" aria-hidden>
              <div className="sh" />
              <div className="bd" />
            </div>
            <div>
              <div style={{ font: `800 19px ${DISPLAY}` }}>Your payment is protected</div>
              <div style={{ fontSize: 14, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>Your card details are encrypted and never stored on our site.</div>
            </div>
          </div>
          <PaymentSlot orderId={orderId} total={total} onCancel={cancel} />
        </div>

        <div style={{ flex: "0 0 380px", maxWidth: "100%" }}>
          <Receipt
            subtitle="You’re almost there"
            lines={order.items.map((i) => ({ key: i.courseId, title: i.title, price: fmt(i.cents, order.currency) }))}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}

/** Sends the buyer to Dodo's hosted payment page. The amount is the server's, not the browser's. */
function PaymentSlot({ orderId, total, onCancel }: { orderId: string; total: string; onCancel: () => void }) {
  const { token } = useAuth();
  const start = useAction(api.dodo.startCheckout);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pay = async () => {
    if (!token || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await start({ token, orderId: orderId as Id<"orders"> });
      if (r.ok) window.location.href = r.url;
      else setErr(r.error);
    } catch {
      setErr("Could not start the payment. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div style={{ background: T.bg, borderRadius: 18, padding: 22, fontSize: 14, lineHeight: 1.6, color: T.body }}>
      <div style={{ marginBottom: 14 }}>You’ll complete your payment on a secure, encrypted page, then come straight back here.</div>
      <div style={{ marginBottom: 18 }}>
        <TrustList />
      </div>
      {/* While the payment page opens, a purple fill sweeps across the button */}
      <button onClick={pay} disabled={busy} className={`btn-hover${busy ? " busy" : ""}`} style={{ width: "100%", border: 0, background: T.orange, color: busy ? "#fff" : T.ink, fontWeight: 800, fontSize: 16, fontFamily: "inherit", padding: 15, borderRadius: 99, cursor: busy ? "default" : "pointer", transition: "color .3s" }}>
        <i className="btn-fill" aria-hidden />
        <span style={{ position: "relative" }}>{busy ? "Opening secure payment…" : `🔒 Pay ${total} now`}</span>
      </button>
      {err && <div role="alert" style={{ marginTop: 10, color: "#b3261e", fontWeight: 600 }}>{err}</div>}
      <button onClick={onCancel} disabled={busy} style={{ display: "block", margin: "12px auto 0", background: "none", border: 0, color: T.muted, font: `700 14px ${DISPLAY}`, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
        Cancel and return to cart
      </button>
    </div>
  );
}
