"use client";

import Link from "next/link";
import { MINE_TABS } from "@/lib/data";
import { DISPLAY, T } from "@/lib/theme";
import { useStore } from "../store";

// Enrolment is not built yet, so nothing is owned. Replace the empty state once purchases exist.
export default function MineView() {
  const { mineTab, set } = useStore();

  return (
    <div>
      <div style={{ background: T.deep, color: "#fff" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 40px 0" }}>
          <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em" }}>My learning</div>
          <div style={{ display: "flex", gap: 28, marginTop: 26, fontWeight: 700 }}>
            {MINE_TABS.map((n) => (
              <span
                key={n}
                onClick={() => set({ mineTab: n })}
                style={{ paddingBottom: 14, cursor: "pointer", borderBottom: `3px solid ${mineTab === n ? T.orange : "transparent"}`, color: mineTab === n ? "#fff" : "oklch(0.8 0.05 300)" }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "30px 40px 60px" }}>
        <div style={{ background: "#fff", borderRadius: 28, padding: 50, textAlign: "center", color: T.muted }}>
          Nothing here yet.{" "}
          <Link href="/courses" style={{ fontWeight: 700 }}>Browse courses →</Link>
        </div>
      </div>
    </div>
  );
}
