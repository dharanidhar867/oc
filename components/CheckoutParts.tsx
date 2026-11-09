import { DISPLAY, T } from "@/lib/theme";

/** "Cart → Payment → Done" so buyers always know where they are. */
export function CheckoutSteps({ current }: { current: "cart" | "pay" | "done" }) {
  const steps = [
    ["cart", "Cart"],
    ["pay", "Payment"],
    ["done", "Done"],
  ] as const;
  const at = steps.findIndex(([k]) => k === current);
  return (
    <ol aria-label="Checkout progress" className="rc-steps" style={{ listStyle: "none", padding: 0 }}>
      {steps.map(([k, label], i) => (
        <li key={k} style={{ display: "contents" }} aria-current={i === at ? "step" : undefined}>
          <span className={`rc-step${i < at ? " done" : i === at ? " cur" : ""}`}>
            <span className="d">{i < at ? "✓" : i + 1}</span>
            {label}
          </span>
          {i < steps.length - 1 && <span className={`rc-ln${i < at ? " done" : ""}`} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

const ROWS: [string, string][] = [
  ["🔒", "Your payment is encrypted and protected"],
  ["💳", "We never see or store your card number"],
  ["⚡", "Courses unlock the moment you pay"],
  ["↩", "30-day money-back guarantee"],
];

/** The reassurance list. `short` shows just the two lines that matter on the cart. */
export function TrustList({ short = false }: { short?: boolean }) {
  const rows = short ? [ROWS[0], ROWS[3]] : ROWS;
  return (
    <div style={{ display: "grid", gap: 10, fontSize: 13, color: T.body }}>
      {rows.map(([icon, text]) => (
        <div key={text} style={{ display: "flex", gap: 10, alignItems: "center", lineHeight: 1.35 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: T.bg, display: "grid", placeItems: "center", flex: "none", fontSize: 15 }}>{icon}</span>
          {text}
        </div>
      ))}
    </div>
  );
}

/** Order summary as a paper receipt: line items, dotted rules, a torn bottom edge. */
export function Receipt({ lines, total, subtitle, children }: { lines: { key: string; title: string; price: string }[]; total: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="rc-wrap">
      <div className="rc-paper">
        <div className="rc-head">
          <div style={{ font: `800 20px ${DISPLAY}` }}>Order summary</div>
          <div style={{ font: "400 11px var(--mono)", color: T.muted, letterSpacing: ".14em", marginTop: 4, textTransform: "uppercase" }}>{subtitle}</div>
        </div>
        {lines.map((l) => (
          <div key={l.key} className="rc-line">
            <span>{l.title}</span>
            <span>{l.price}</span>
          </div>
        ))}
        <div className="rc-total">
          <span>Total</span>
          <span>{total}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
