import { DISPLAY, T } from "@/lib/theme";

// Placeholder partner wordmarks (fictional names) — swap for real, approved partner logos before launch.
const BRANDS: { name: string; glyph: React.ReactNode; style?: React.CSSProperties }[] = [
  { name: "Halcyon", glyph: <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="3" />, style: { fontWeight: 800, letterSpacing: "-.02em" } },
  { name: "NIMBUS", glyph: <path d="M3 22 L14 4 L25 22 Z" fill="currentColor" />, style: { fontWeight: 800, letterSpacing: ".16em", fontSize: 20 } },
  { name: "Pinecrest", glyph: <rect x="4" y="4" width="20" height="20" rx="6" fill="currentColor" />, style: { fontWeight: 600, fontStyle: "italic" } },
  { name: "vantage", glyph: <path d="M4 6 L14 24 L24 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />, style: { fontWeight: 800, fontSize: 30, letterSpacing: "-.04em" } },
  { name: "Meridian", glyph: <><circle cx="14" cy="14" r="11" fill="currentColor" /><circle cx="18" cy="12" r="9" fill={T.bg} /></>, style: { fontWeight: 800 } },
  { name: "ARCADIA labs", glyph: <path d="M4 22 Q14 -2 24 22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />, style: { fontWeight: 700, letterSpacing: ".06em", fontSize: 19 } },
  { name: "Quanta", glyph: <><rect x="3" y="3" width="10" height="10" fill="currentColor" /><rect x="15" y="15" width="10" height="10" fill="currentColor" /></>, style: { fontWeight: 800, letterSpacing: "-.03em" } },
  { name: "Stellar&Co", glyph: <path d="M14 2 L17 11 L26 11 L19 17 L22 26 L14 20 L6 26 L9 17 L2 11 L11 11 Z" fill="currentColor" />, style: { fontWeight: 600, fontSize: 24 } },
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <div aria-hidden={hidden} style={{ display: "flex", flex: "none", alignItems: "center", gap: 72, paddingRight: 72 }}>
      {BRANDS.map((b) => (
        <div key={b.name} className="brand" style={{ display: "flex", alignItems: "center", gap: 10, color: "oklch(0.62 0.04 300)", font: `800 26px ${DISPLAY}`, whiteSpace: "nowrap", ...b.style }}>
          <svg width="28" height="28" viewBox="0 0 28 28" style={{ flex: "none" }}>{b.glyph}</svg>
          {b.name}
        </div>
      ))}
    </div>
  );
}

export default function TrustedBy() {
  return (
    <section style={{ paddingTop: 64 }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, color: T.muted2, marginBottom: 26 }}>
        QuickAI is trusted by over 17,000 companies and millions of learners around the world
      </div>
      <div className="marquee" style={{ overflow: "hidden" }}>
        {/* Slides left to right; the row is rendered twice so the loop is seamless. */}
        <div className="marquee-track" style={{ animationDirection: "reverse" }}>
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}
