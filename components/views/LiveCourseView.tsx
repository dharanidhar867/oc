"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { money } from "@/lib/data";
import { fmtDuration } from "@/lib/upload";
import { DISPLAY, T } from "@/lib/theme";

/** Public page for a course an admin approved. Shows the free promo, the outline and the price. */
export default function LiveCourseView({ id }: { id: string }) {
  const c = useQuery(api.catalog.getLive, { id });

  if (c === undefined) return <div style={{ minHeight: "60vh" }} />;
  if (c === null)
    return (
      <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 40px", textAlign: "center" }}>
        <div style={{ font: `800 28px ${DISPLAY}` }}>This course isn’t available</div>
        <div style={{ color: T.muted2, margin: "10px 0 20px" }}>It may have been unpublished or the link is wrong.</div>
        <Link href="/courses" style={{ fontWeight: 700 }}>Browse courses →</Link>
      </div>
    );

  return (
    <div>
      <div style={{ background: T.deep, color: "#fff" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 40px 40px" }}>
          <div style={{ maxWidth: 800 }}>
            <Link href={`/courses?category=${encodeURIComponent(c.category)}`} style={{ fontSize: 14, color: "oklch(0.85 0.08 300)" }}>
              {c.category}
            </Link>
            <div style={{ font: `800 46px/1.05 ${DISPLAY}`, letterSpacing: "-.03em", margin: "12px 0" }}>{c.title}</div>
            <div style={{ fontSize: 19, lineHeight: 1.45, color: "oklch(0.92 0.04 300)" }}>{c.subtitle}</div>
            <div style={{ fontSize: 15, marginTop: 16 }}>
              Created by <b style={{ color: "oklch(0.88 0.1 300)" }}>{c.instructorName}</b> · {c.level} · {c.lessonCount} lessons · {Math.max(1, Math.round(c.totalSeconds / 60))} min
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "30px 40px 60px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 370px", gap: 44 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
          <div style={{ background: "#fff", borderRadius: 28, padding: 26 }}>
            <div style={{ font: `800 24px ${DISPLAY}`, marginBottom: 10 }}>About this course</div>
            <div style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{c.description}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 28, padding: 26 }}>
            <div style={{ font: `800 24px ${DISPLAY}`, marginBottom: 10 }}>Course content</div>
            {c.sections.map((s) => (
              <div key={s.id} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800 }}>{s.title}</div>
                {s.lessons.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.line}`, fontSize: 15 }}>
                    <span>{l.title}</span>
                    <span style={{ color: T.muted }}>{fmtDuration(l.duration)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ alignSelf: "start", position: "sticky", top: 90, background: "#fff", borderRadius: 28, padding: 22 }}>
          {c.promoUrl ? (
            <video src={c.promoUrl} controls preload="metadata" poster={c.thumbnail} style={{ width: "100%", borderRadius: 18, background: "#000" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnail} alt="" style={{ width: "100%", borderRadius: 18 }} />
          )}
          <div style={{ font: `800 34px ${DISPLAY}`, margin: "14px 0 10px" }}>{money(c.price)}</div>
          <button disabled style={{ width: "100%", border: 0, background: T.purple, color: "#fff", borderRadius: 99, padding: 14, fontWeight: 800, fontSize: 15, fontFamily: "inherit", opacity: 0.55, cursor: "not-allowed" }}>
            Enrolment opens soon
          </button>
        </div>
      </div>
    </div>
  );
}
