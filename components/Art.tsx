// Original SVG illustrations used wherever a tile would otherwise be an empty colour block.
// Self-contained (no image files, no network, no licences) and decorative only, so hidden from screen readers.

const INK = "#2b2540";
const SKIN = "#f2c9a5";

/** Hero scenes: "learner" (tall), "idea" and "books" (wide). They fill their tile and crop to fit. */
export function HeroArt({ kind }: { kind: "learner" | "idea" | "books" }) {
  const common = { "aria-hidden": true, focusable: false, preserveAspectRatio: "xMidYMid slice", style: { width: "100%", height: "100%", display: "block" } } as const;

  if (kind === "learner")
    return (
      <svg viewBox="0 0 320 420" {...common}>
        <rect width="320" height="420" fill="oklch(0.88 0.09 300)" />
        <circle cx="236" cy="96" r="72" fill="oklch(0.95 0.06 300)" />
        <circle cx="52" cy="210" r="34" fill="oklch(0.93 0.07 300)" />
        {/* floating cards */}
        <g transform="rotate(-6 70 100)">
          <rect x="26" y="66" width="92" height="58" rx="14" fill="#fff" />
          <circle cx="48" cy="88" r="9" fill="oklch(0.85 0.14 150)" />
          <path d="M43 88l4 4 7-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="64" y="82" width="42" height="6" rx="3" fill="oklch(0.88 0.04 300)" />
          <rect x="64" y="95" width="30" height="6" rx="3" fill="oklch(0.92 0.03 300)" />
        </g>
        <g transform="rotate(5 250 170)">
          <rect x="204" y="142" width="84" height="54" rx="14" fill="oklch(0.9 0.1 90)" />
          <path d="M226 156l4 9h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="oklch(0.75 0.16 70)" transform="translate(4 -4) scale(.9)" />
          <rect x="248" y="162" width="28" height="6" rx="3" fill="#fff" opacity=".8" />
        </g>
        {/* desk */}
        <rect y="318" width="320" height="102" fill="oklch(0.78 0.1 300)" />
        <rect y="318" width="320" height="8" fill="oklch(0.72 0.11 300)" />
        {/* person */}
        <rect x="116" y="170" width="88" height="96" rx="38" fill="oklch(0.72 0.17 40)" />
        <rect x="150" y="150" width="20" height="26" rx="8" fill={SKIN} />
        <circle cx="160" cy="132" r="32" fill={SKIN} />
        <path d="M127 128a33 33 0 0 1 66 0c-10-14-24-16-34-12-14-6-26 0-32 12z" fill={INK} />
        <path d="M128 126c-6 18 0 34 6 40-2-14 0-28 4-38z" fill={INK} />
        <circle cx="149" cy="136" r="3" fill={INK} />
        <circle cx="171" cy="136" r="3" fill={INK} />
        <path d="M150 148q10 9 20 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* laptop */}
        <rect x="102" y="232" width="116" height="80" rx="9" fill={INK} />
        <rect x="109" y="239" width="102" height="66" rx="5" fill="oklch(0.96 0.04 90)" />
        <rect x="118" y="249" width="38" height="6" rx="3" fill="oklch(0.7 0.17 40)" />
        <rect x="124" y="261" width="58" height="6" rx="3" fill="oklch(0.6 0.15 300)" />
        <rect x="124" y="273" width="44" height="6" rx="3" fill="oklch(0.8 0.1 150)" />
        <rect x="118" y="285" width="64" height="6" rx="3" fill="oklch(0.6 0.15 300)" />
        <rect x="88" y="310" width="144" height="12" rx="6" fill="oklch(0.35 0.05 300)" />
        {/* mug */}
        <rect x="34" y="292" width="30" height="28" rx="7" fill="#fff" />
        <path d="M64 298h6a7 7 0 0 1 0 14h-6" stroke="#fff" strokeWidth="4" fill="none" />
        <path d="M43 284q-4-6 0-12M54 284q-4-6 0-12" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
        {/* plant */}
        <rect x="248" y="284" width="42" height="36" rx="8" fill="oklch(0.72 0.17 40)" />
        <ellipse cx="258" cy="262" rx="9" ry="24" fill="oklch(0.7 0.14 150)" transform="rotate(-24 258 262)" />
        <ellipse cx="280" cy="258" rx="9" ry="26" fill="oklch(0.62 0.14 150)" transform="rotate(20 280 258)" />
        <ellipse cx="269" cy="252" rx="8" ry="28" fill="oklch(0.75 0.14 150)" />
      </svg>
    );

  if (kind === "idea")
    return (
      <svg viewBox="0 0 320 190" {...common}>
        <rect width="320" height="190" fill="oklch(0.9 0.1 90)" />
        <circle cx="48" cy="40" r="22" fill="oklch(0.95 0.07 90)" />
        <circle cx="286" cy="158" r="30" fill="oklch(0.95 0.07 90)" />
        <g stroke="oklch(0.7 0.17 55)" strokeWidth="5" strokeLinecap="round">
          <path d="M160 20v-10M112 40l-8-8M208 40l8-8M96 82H84M224 82h12" />
        </g>
        <circle cx="160" cy="84" r="40" fill="oklch(0.98 0.08 95)" stroke={INK} strokeWidth="5" />
        <path d="M146 84q14-22 28 0" stroke="oklch(0.7 0.17 55)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M148 120h24v10a12 12 0 0 1-24 0z" fill={INK} />
        <rect x="144" y="116" width="32" height="8" rx="3" fill={INK} />
        {/* code brackets */}
        <g stroke={INK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M70 128l-22 20 22 20" />
          <path d="M250 128l22 20-22 20" />
          <path d="M168 150l-12 0" opacity="0" />
        </g>
        <path d="M172 140l-24 34" stroke="oklch(0.7 0.17 55)" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );

  return (
    <svg viewBox="0 0 320 190" {...common}>
      <rect width="320" height="190" fill="oklch(0.9 0.08 150)" />
      <circle cx="268" cy="44" r="26" fill="oklch(0.95 0.06 150)" />
      <circle cx="46" cy="150" r="30" fill="oklch(0.95 0.06 150)" />
      {/* books */}
      <rect x="95" y="152" width="136" height="26" rx="6" fill="oklch(0.6 0.15 300)" />
      <rect x="105" y="156" width="6" height="18" rx="3" fill="#fff" opacity=".6" />
      <rect x="105" y="124" width="116" height="26" rx="6" fill="oklch(0.72 0.17 40)" />
      <rect x="115" y="128" width="6" height="18" rx="3" fill="#fff" opacity=".6" />
      <rect x="92" y="96" width="128" height="26" rx="6" fill="#fff" />
      <rect x="102" y="100" width="6" height="18" rx="3" fill="oklch(0.85 0.1 150)" />
      {/* cap */}
      <path d="M130 62v20q30 18 60 0V62z" fill={INK} />
      <path d="M160 18L222 42l-62 24L98 42z" fill={INK} />
      <path d="M160 24L206 42l-46 18L114 42z" fill="oklch(0.35 0.06 300)" />
      <path d="M214 46v26" stroke="oklch(0.8 0.15 80)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="214" cy="76" r="5" fill="oklch(0.8 0.15 80)" />
      {/* sparkles */}
      <path d="M268 112l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="oklch(0.85 0.15 85)" />
      <path d="M52 52l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff" />
    </svg>
  );
}

export type TopicKind = "ai" | "code" | "web" | "data" | "design" | "marketing" | "excel" | "lang";

const GLYPH: Record<TopicKind, React.ReactNode> = {
  ai: (
    <>
      <path d="M22 8l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" />
      <path d="M38 6l1.6 4.4L44 12l-4.4 1.6L38 18l-1.6-4.4L32 12l4.4-1.6z" />
    </>
  ),
  code: <path d="M18 14L8 24l10 10M30 14l10 10-10 10M27 9l-6 30" />,
  web: (
    <>
      <circle cx="24" cy="24" r="16" />
      <ellipse cx="24" cy="24" rx="7" ry="16" />
      <path d="M8 24h32" />
    </>
  ),
  data: (
    <>
      <path d="M8 40h34" />
      <rect x="11" y="25" width="7" height="12" rx="2" />
      <rect x="21" y="16" width="7" height="21" rx="2" />
      <rect x="31" y="8" width="7" height="29" rx="2" />
    </>
  ),
  design: (
    <>
      <path d="M10 39l4-12L32 9l7 7-18 18z" />
      <path d="M27 14l7 7" />
    </>
  ),
  marketing: (
    <>
      <path d="M9 19h9l16-10v30L18 29H9z" />
      <path d="M14 29l2 9h5l-2-9" />
      <path d="M39 18q4 6 0 12" />
    </>
  ),
  excel: (
    <>
      <rect x="8" y="8" width="32" height="32" rx="5" />
      <path d="M8 19h32M8 29h32M19 8v32" />
    </>
  ),
  lang: (
    <>
      <rect x="6" y="8" width="26" height="20" rx="6" />
      <path d="M13 28l-2 8 8-8" />
      <path d="M32 20h6a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-1l1 6-7-6h-7" />
    </>
  ),
};

/** A topic icon. `hue` tints the line colour to match the tile behind it. */
export function TopicGlyph({ kind, hue, size }: { kind: TopicKind; hue: number; size: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
      focusable={false}
      fill="oklch(1 0 0 / .55)"
      stroke={`oklch(0.38 0.14 ${hue})`}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      {GLYPH[kind]}
    </svg>
  );
}
