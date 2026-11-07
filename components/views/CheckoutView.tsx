"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";

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
    return (
      <div style={{ maxWidth: 640, margin: "40px auto", ...card, textAlign: "center" }}>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{msg}</div>
        <Link href={order?.status === "paid" ? "/my-courses" : "/cart"} className="nl" style={{ background: T.orange, fontWeight: 700, padding: "14px 26px", borderRadius: 99, display: "inline-block" }}>
          {order?.status === "paid" ? "Go to my courses" : "Back to cart"}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 40px 60px" }}>
      <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 20px" }}>Secure checkout</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 460px", ...card }}>
          <div style={{ font: `800 22px ${DISPLAY}`, marginBottom: 14 }}>Payment</div>
          <PaymentSlot orderId={orderId} />
          <div style={{ marginTop: 16, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
            🔒 Payments are processed over an encrypted connection. We never see or store your card number.
          </div>
        </div>

        <div style={{ flex: "0 0 380px", maxWidth: "100%", ...card }}>
          <div style={{ font: `800 22px ${DISPLAY}`, marginBottom: 14 }}>Order summary</div>
          {order.items.map((i) => (
            <div key={i.courseId} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, padding: "5px 0", color: T.body }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</span>
              <span>{fmt(i.cents, order.currency)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", font: `800 24px ${DISPLAY}`, padding: "14px 0", borderTop: "1.5px solid oklch(0.92 0.02 95)", marginTop: 8 }}>
            <span>Total</span>
            <span>{fmt(order.totalCents, order.currency)}</span>
          </div>
          <button onClick={cancel} className="btn-hover" style={{ width: "100%", border: 0, background: T.bg, color: T.body, fontWeight: 700, fontSize: 15, fontFamily: "inherit", padding: 14, borderRadius: 99, cursor: "pointer" }}>
            Cancel and return to cart
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sends the buyer to Dodo's hosted payment page. The amount is the server's, not the browser's. */
function PaymentSlot({ orderId }: { orderId: string }) {
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
      <div style={{ marginBottom: 14 }}>You’ll pay on Dodo Payments’ secure page, then come straight back here.</div>
      <button onClick={pay} disabled={busy} className="btn-hover" style={{ width: "100%", border: 0, background: T.orange, color: "#000", fontWeight: 800, fontSize: 16, fontFamily: "inherit", padding: 16, borderRadius: 99, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Opening secure payment…" : "Pay now"}
      </button>
      {err && <div role="alert" style={{ marginTop: 10, color: "#b3261e", fontWeight: 600 }}>{err}</div>}
    </div>
  );
}
