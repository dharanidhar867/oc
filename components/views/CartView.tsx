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
import { Doodle, ticket } from "../sticker-fx";
import { CheckoutSteps, Receipt, TrustList } from "../CheckoutParts";

export default function CartView() {
  const { token } = useAuth();
  const live = useQuery(api.cart.list, token ? { token } : "skip");
  const removeM = useMutation(api.cart.remove);
  const checkoutM = useMutation(api.payments.createOrder);
  const router = useRouter();
  const [note, setNote] = useState("");
  const remove = (id: string, title: string) =>
    token &&
    removeM({ token, courseId: id as Id<"submissions"> })
      .then(() => ticket("Removed from cart", title))
      .catch((e) => setNote(errorMessage(e)));
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
      <h1 style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 6px" }}>Shopping cart</h1>
      {items.length > 0 && <CheckoutSteps current="cart" />}

      {live === undefined && <div style={{ minHeight: 200 }} />}

      {empty && (
        <div style={{ background: "#fff", borderRadius: 30, padding: 50, textAlign: "center" }}>
          <Doodle />
          <div style={{ font: `800 24px ${DISPLAY}` }}>Your cart is empty</div>
          <div style={{ color: T.muted, margin: "6px 0 20px" }}>Find something you’ll love learning.</div>
          <Link href="/courses" className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "13px 26px", borderRadius: 99, cursor: "pointer", display: "inline-block" }}>
            Keep shopping <span className="arr">→</span>
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 30, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: T.muted2 }}>{items.length} course{items.length === 1 ? "" : "s"} in your cart</div>
            {items.map((c) => (
              <div key={c.id} className="rc-item" style={{ background: "#fff", borderRadius: 26, padding: 14, display: "grid", gridTemplateColumns: "150px minmax(0,1fr) auto", gap: 18, alignItems: "center" }}>
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
                  <button onClick={() => remove(c.id, c.title)} aria-label={`Remove ${c.title} from cart`} style={{ background: "none", border: 0, padding: 0, fontFamily: "inherit", fontSize: 13, color: T.danger, cursor: "pointer", marginTop: 6, fontWeight: 700 }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: "0 0 380px", maxWidth: "100%" }}>
            <Receipt
              subtitle={`QuickAI · ${items.length} course${items.length === 1 ? "" : "s"}`}
              lines={items.map((c) => ({ key: c.id, title: c.title, price: money(c.price) }))}
              total={money(total)}
            >
              <button
                onClick={checkout}
                className="btn-hover"
                style={{ width: "100%", border: 0, background: T.purple, color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "inherit", padding: 14, borderRadius: 99, cursor: "pointer" }}
              >
                Checkout <span className="arr">→</span>
              </button>
              {note && (
                <div role="status" style={{ marginTop: 14, background: T.bg, borderRadius: 16, padding: 14, fontSize: 14, lineHeight: 1.5, color: T.body }}>
                  {note}
                </div>
              )}
              <div style={{ marginTop: 18 }}>
                <TrustList short />
              </div>
            </Receipt>
          </div>
        </div>
      )}
    </div>
  );
}
