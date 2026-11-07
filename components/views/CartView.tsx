"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { money } from "@/lib/data";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/upload";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";

export default function CartView() {
  const { token } = useAuth();
  const live = useQuery(api.cart.list, token ? { token } : "skip");
  const removeM = useMutation(api.cart.remove);
  const checkoutM = useMutation(api.payments.createOrder);
  const router = useRouter();
  const [note, setNote] = useState("");
  const remove = (id: string) => token && removeM({ token, courseId: id as Id<"submissions"> }).catch((e) => setNote(errorMessage(e)));
  const checkout = async () => {
    if (!token) return;
    try {
      const r = await checkoutM({ token });
      if (r.ok) router.push(`/checkout/${r.orderId}`);
      else setNote(r.error);
    } catch (e) {
      setNote(errorMessage(e));
    }
  };

  const items = live ?? [];
  const total = items.reduce((n, c) => n + c.price, 0);
  const empty = live !== undefined && items.length === 0;

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "10px 40px 60px" }}>
      <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 20px" }}>Shopping cart</div>

      {live === undefined && <div style={{ minHeight: 200 }} />}

      {empty && (
        <div style={{ background: "#fff", borderRadius: 30, padding: 50, textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 16 }}>Your cart is empty.</div>
          <Link href="/courses" className="nl" style={{ background: T.orange, fontWeight: 700, padding: "14px 26px", borderRadius: 99, cursor: "pointer", display: "inline-block" }}>
            Keep shopping
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: T.muted2 }}>{items.length} course{items.length === 1 ? "" : "s"} in your cart</div>
            {items.map((c) => (
              <div key={c.id} style={{ background: "#fff", borderRadius: 26, padding: 14, display: "grid", gridTemplateColumns: "150px minmax(0,1fr) auto", gap: 18, alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 16 }} />
                <div>
                  <Link href={`/course/live/${c.id}`} className="nl" style={{ font: `800 18px/1.2 ${DISPLAY}` }}>{c.title}</Link>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    By {c.instructorName} · {c.level} · {c.lessonCount} lessons
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ font: `800 20px ${DISPLAY}` }}>{money(c.price)}</div>
                  <div onClick={() => remove(c.id)} style={{ fontSize: 13, color: T.danger, cursor: "pointer", marginTop: 6, fontWeight: 700 }}>
                    Remove
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: "0 0 380px", maxWidth: "100%", background: "#fff", borderRadius: 30, padding: 26, position: "sticky", top: 110 }}>
            <div style={{ font: `800 22px ${DISPLAY}`, marginBottom: 14 }}>Order summary</div>
            {items.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, padding: "5px 0", color: T.body }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <span>{money(c.price)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", font: `800 24px ${DISPLAY}`, padding: "14px 0", borderTop: "1.5px solid oklch(0.92 0.02 95)", marginTop: 8 }}>
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <button
              onClick={checkout}
              className="btn-hover"
              style={{ width: "100%", border: 0, background: T.purple, color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "inherit", padding: 16, borderRadius: 99, cursor: "pointer" }}
            >
              Checkout
            </button>
            {note && (
              <div role="status" style={{ marginTop: 14, background: T.bg, borderRadius: 16, padding: 14, fontSize: 14, lineHeight: 1.5, color: T.body }}>
                {note}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
