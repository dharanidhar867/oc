import type { CourseStatus } from "@/lib/moderation";
import { T } from "@/lib/theme";

const STYLE: Record<CourseStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: T.line, fg: T.ink },
  in_review: { label: "In review", bg: T.yellow, fg: T.ink },
  live: { label: "Live", bg: "oklch(0.9 0.08 150)", fg: "oklch(0.35 0.08 150)" },
  rejected: { label: "Rejected", bg: "oklch(0.93 0.05 20)", fg: "oklch(0.4 0.15 20)" },
  taken_down: { label: "Taken down", bg: "oklch(0.93 0.05 20)", fg: "oklch(0.4 0.15 20)" },
};

export function StatusBadge({ status }: { status: CourseStatus }) {
  const s = STYLE[status];
  return <span style={{ fontSize: 12, fontWeight: 700, background: s.bg, color: s.fg, padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{s.label}</span>;
}
