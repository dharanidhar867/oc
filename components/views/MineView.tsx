"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";

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
            You haven’t bought any courses yet.{" "}
            <Link href="/courses" style={{ fontWeight: 700 }}>Browse courses →</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>
            {courses.map((c) => (
              <Link key={c.id} href={`/learn/${c.id}`} className="nl btn-hover" style={{ background: "#fff", borderRadius: 24, overflow: "hidden", display: "block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
                <div style={{ padding: 18 }}>
                  <div style={{ fontSize: 13, color: T.muted, fontWeight: 700 }}>{c.category}</div>
                  <div style={{ font: `800 19px/1.25 ${DISPLAY}`, margin: "6px 0", overflowWrap: "anywhere" }}>{c.title}</div>
                  <div style={{ fontSize: 14, color: T.muted }}>{c.instructorName}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 10 }}>
                    {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"} · {length(c.totalSeconds)}
                  </div>
                  <div style={{ marginTop: 14, background: T.orange, borderRadius: 99, padding: "10px 0", textAlign: "center", fontWeight: 800 }}>Start learning</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
