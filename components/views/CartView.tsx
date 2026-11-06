"use client";

import Link from "next/link";
import { DISPLAY, T } from "@/lib/theme";

// Checkout is not built yet, so the cart is always empty. Replace this once purchases are implemented.
export default function CartView() {
  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "10px 40px 60px" }}>
      <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 20px" }}>Shopping cart</div>
      <div style={{ background: "#fff", borderRadius: 30, padding: 50, textAlign: "center" }}>
        <div style={{ fontSize: 18, marginBottom: 16 }}>Your cart is empty.</div>
        <Link href="/courses" className="nl" style={{ background: T.orange, fontWeight: 700, padding: "14px 26px", borderRadius: 99, cursor: "pointer", display: "inline-block" }}>
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
