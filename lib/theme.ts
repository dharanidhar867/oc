// Design tokens from the prototype (REQUIREMENTS.md §9 + inline styles).
export const T = {
  bg: "oklch(0.97 0.02 95)",
  ink: "#2b2540",
  muted: "#6b6585",
  muted2: "#5d5675",
  body: "#4b4466",
  purple: "oklch(0.55 0.2 300)",
  orange: "oklch(0.75 0.16 40)",
  yellow: "oklch(0.88 0.12 90)",
  deep: "oklch(0.28 0.09 300)",
  line: "oklch(0.94 0.02 95)",
  star: "oklch(0.65 0.16 60)",
  danger: "oklch(0.55 0.2 20)",
  strike: "#8b84a3",
};

export const DISPLAY = "var(--display)"; // Bricolage Grotesque
export const MONO = "var(--mono)"; // Space Mono

export const pastel = (h: number, l = 0.9, c = 0.08) => `oklch(${l} ${c} ${h})`;
