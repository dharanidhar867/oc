"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import { Doodle } from "../sticker-fx";

const length = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.max(1, Math.round(s / 60))} min`);

/** The student's purchased courses. Ownership comes from the server (enrollments written after a verified payment). */
export default function MineView() {
  const { token } = useAuth();
  const courses = useQuery(api.learning.myCourses, token ? { token } : "skip");

  return (
    <div>
      <div style={{ background: T.deep, color: "#fff" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 40px 36px" }}>
          <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em" }}>My learning</div>
        </div>
      </div>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "30px 40px 60px" }}>
        {courses === undefined ? (
          <div style={{ minHeight: 300 }} />
        ) : courses.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 28, padding: 50, textAlign: "center", color: T.muted }}>
            <Doodle />
            <div style={{ font: `800 24px ${DISPLAY}`, color: T.ink }}>Your desk is empty</div>
            <div style={{ margin: "6px 0 20px" }}>You haven’t bought any courses yet.</div>
            <Link href="/courses" className="nl btn-hover" style={{ display: "inline-block", background: T.orange, color: T.ink, fontWeight: 700, padding: "13px 26px", borderRadius: 99 }}>
              Browse courses <span className="arr">→</span>
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "34px 26px", paddingTop: 12 }}>
            {courses.map((c, i) => (
              // Taped-on index card that straightens when hovered
              <Link key={c.id} href={`/learn/${c.id}`} className="nl card-hover taped" style={{ background: "#fff", borderRadius: 24, padding: 12, display: "block", ["--r" as string]: `${[-1.1, 0.8, -0.5, 1.2][i % 4]}deg` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block", borderRadius: 16 }} />
                <div style={{ padding: "16px 6px 6px" }}>
                  <div style={{ fontSize: 13, color: T.muted, fontWeight: 700 }}>{c.category}</div>
                  <div style={{ font: `800 19px/1.25 ${DISPLAY}`, margin: "6px 0", overflowWrap: "anywhere" }}>{c.title}</div>
                  <div style={{ fontSize: 14, color: T.muted }}>{c.instructorName}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 10 }}>
                    {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"} · {length(c.totalSeconds)}
                  </div>
                  {(() => {
                    const pct = c.lessonCount ? Math.round((c.completedCount / c.lessonCount) * 100) : 0;
                    return (
                      <>
                        <div style={{ height: 6, borderRadius: 99, background: T.bg, overflow: "hidden", marginTop: 12 }}>
                          <div className="spring-bar" style={{ width: `${pct}%`, height: "100%", background: T.orange, borderRadius: 99 }} />
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{pct === 100 ? "🎓 Completed" : `${pct}% complete`}</div>
                        <div style={{ marginTop: 14, background: pct === 0 ? T.purple : T.orange, color: pct === 0 ? "#fff" : T.ink, border: `2px solid ${T.ink}`, boxShadow: `0 4px 0 ${T.ink}`, borderRadius: 99, padding: "9px 0", textAlign: "center", fontWeight: 800 }}>
                          {pct === 0 ? "Start learning" : pct === 100 ? "Watch again" : "Continue learning"}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
