"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LEVELS, SORTS, fmt, money } from "@/lib/data";
import { DISPLAY, T } from "@/lib/theme";
import { useStore } from "../store";

function Radio({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", cursor: "pointer", fontSize: 15 }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${T.purple}`, background: on ? T.purple : "transparent" }}></span>
      {label}
    </div>
  );
}

export default function CatalogView() {
  const cat = useSearchParams().get("category");
  const { q, lvl, sort, set } = useStore();

  const title = q ? "Results for “" + q + "”" : cat || "All courses";
  // Courses approved by an admin are listed under the category the instructor chose.
  const liveAll = useQuery(api.catalog.listLive) ?? [];
  const live = liveAll
    .filter(
      (c) =>
        (!cat || c.category === cat) &&
        (lvl === "All" || c.level === lvl || c.level === "All Levels") &&
        (!q || (c.title + c.subtitle + c.instructorName).toLowerCase().includes(q.toLowerCase())),
    )
    .sort((a, b) => (sort === "low" ? a.price - b.price : b.publishedAt - a.publishedAt));
  const resCount = fmt(live.length);
  const card: React.CSSProperties = { background: "#fff", borderRadius: 24, padding: 20 };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "10px 40px 60px" }}>
      <div style={{ fontSize: 14, color: T.muted }}>
        <Link href="/" className="nl" onClick={() => set({ q: "" })} style={{ cursor: "pointer" }}>
          Home
        </Link>{" "}
        › {title}
      </div>
      <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 4px" }}>{title}</div>
      <div style={{ color: T.muted2, marginBottom: 22 }}>{resCount} courses</div>

      <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0,1fr)", gap: 30 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, alignSelf: "start" }}>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Level</div>
            {LEVELS.map((n) => (
              <Radio key={n} label={n} on={lvl === n} onClick={() => set({ lvl: n })} />
            ))}
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Sort by</div>
            {SORTS.map(([k, n]) => (
              <Radio key={k} label={n} on={sort === k} onClick={() => set({ sort: k })} />
            ))}
          </div>
          <div style={{ ...card, fontSize: 14, color: T.muted, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 800, color: T.ink, marginBottom: 6 }}>More filters (v1)</div>
            Rating · Duration · Price · Language · Features · Subtitles
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {live.map((c) => (
            <Link
              key={c.id}
              href={`/course/live/${c.id}`}
              className="nl card-hover"
              style={{ cursor: "pointer", background: "#fff", borderRadius: 28, padding: 14, display: "grid", gridTemplateColumns: "230px minmax(0,1fr) 120px", gap: 20, alignItems: "center" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.thumbnail} alt="" style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 20 }} />
              <div>
                <div style={{ font: `800 21px/1.2 ${DISPLAY}` }}>{c.title}</div>
                <div style={{ color: T.muted2, fontSize: 14, margin: "6px 0" }}>{c.subtitle}</div>
                <div style={{ fontSize: 13, color: T.muted }}>{c.instructorName}</div>
                <div style={{ fontSize: 14, marginTop: 6 }}>
                  {c.lessonCount} lessons · {Math.max(1, Math.round(c.totalSeconds / 60))} min · {c.level}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ font: `800 22px ${DISPLAY}` }}>{money(c.price)}</div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, background: T.yellow, padding: "3px 10px", borderRadius: 99, display: "inline-block" }}>New</div>
              </div>
            </Link>
          ))}
          {live.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 28, padding: 50, textAlign: "center", color: T.muted }}>
              No courses here yet. Check back soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
