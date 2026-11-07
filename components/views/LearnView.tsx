"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { fmtDuration } from "@/lib/upload";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import VideoPlayer from "../VideoPlayer";

/** Course player for a course the student owns. The server returns nothing (null) unless they bought it. */
export default function LearnView({ id }: { id: string }) {
  const { token } = useAuth();
  const c = useQuery(api.learning.getCourse, token ? { token, courseId: id } : "skip");
  const [current, setCurrent] = useState<string | null>(null);

  if (c === undefined) return <div style={{ minHeight: "60vh" }} />;
  if (c === null)
    return (
      <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 40px", textAlign: "center" }}>
        <div style={{ font: `800 28px ${DISPLAY}` }}>You don’t have access to this course</div>
        <div style={{ color: T.muted2, margin: "10px 0 20px" }}>Buy the course to unlock its lessons. If you just paid, give it a few seconds.</div>
        <Link href={`/course/live/${id}`} style={{ fontWeight: 700 }}>View the course →</Link>
      </div>
    );

  const lessons = c.sections.flatMap((s) => s.lessons);
  const lesson = lessons.find((l) => l.id === current) ?? lessons[0];
  const idx = lesson ? lessons.indexOf(lesson) : -1;

  return (
    <div className="course-layout" style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 40px 60px" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.muted, marginBottom: 6 }}>
          <Link href="/my-courses">My learning</Link> › {c.title}
        </div>
        {lesson ? (
          <>
            {lesson.videoUrl ? (
              <VideoPlayer key={lesson.id} src={lesson.videoUrl} style={{ borderRadius: 22 }} />
            ) : (
              <div style={{ aspectRatio: "16 / 9", borderRadius: 22, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                This video isn’t available right now.
              </div>
            )}
            <div style={{ font: `800 28px/1.2 ${DISPLAY}`, letterSpacing: "-.02em", margin: "18px 0 6px" }}>{lesson.title}</div>
            <div style={{ color: T.muted, fontSize: 14 }}>
              Lesson {idx + 1} of {lessons.length} · {c.instructorName}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button disabled={idx <= 0} onClick={() => setCurrent(lessons[idx - 1].id)} style={navBtn(idx <= 0)}>← Previous</button>
              <button disabled={idx >= lessons.length - 1} onClick={() => setCurrent(lessons[idx + 1].id)} style={navBtn(idx >= lessons.length - 1)}>Next →</button>
            </div>
          </>
        ) : (
          <div style={{ background: "#fff", borderRadius: 28, padding: 50, textAlign: "center", color: T.muted }}>The instructor hasn’t published any lessons yet.</div>
        )}
      </div>

      <div className="course-buy" style={{ background: "#fff", borderRadius: 28, padding: 18, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
        <div style={{ font: `800 20px ${DISPLAY}`, margin: "4px 6px 12px" }}>Course content</div>
        {c.sections.map((s) => (
          <div key={s.id} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 14, padding: "8px 6px" }}>{s.title}</div>
            {s.lessons.map((l) => {
              const on = l.id === lesson?.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setCurrent(l.id)}
                  aria-current={on}
                  style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", textAlign: "left", border: 0, borderRadius: 14, padding: "10px 12px", background: on ? T.bg : "transparent", fontFamily: "inherit", fontSize: 14, fontWeight: on ? 800 : 500, cursor: "pointer", color: T.ink }}
                >
                  <span aria-hidden>{on ? "▶" : "○"}</span>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{l.title}</span>
                  <span style={{ color: T.muted, fontSize: 13 }}>{fmtDuration(l.duration)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtn = (off: boolean): React.CSSProperties => ({
  border: `2px solid ${T.ink}`,
  background: "#fff",
  color: T.ink,
  borderRadius: 99,
  padding: "10px 18px",
  fontWeight: 800,
  fontSize: 14,
  fontFamily: "inherit",
  cursor: off ? "default" : "pointer",
  opacity: off ? 0.4 : 1,
});
