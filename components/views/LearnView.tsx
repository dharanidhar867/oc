"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtDuration } from "@/lib/upload";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import VideoPlayer from "../VideoPlayer";
import { ticket } from "../sticker-fx";

/**
 * Course player for a course the student owns. The server returns nothing (null) unless they bought it,
 * and each lesson's video is a short-lived signed link fetched by <VideoPlayer> after a fresh access check.
 */
export default function LearnView({ id }: { id: string }) {
  const { token } = useAuth();
  const c = useQuery(api.learning.getCourse, token ? { token, courseId: id } : "skip");
  const setDone = useMutation(api.learning.setCompleted);
  const [current, setCurrent] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null); // the lesson that just got stamped (animates once)

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
  // Open where the student left off: the chosen lesson, else the last one watched, else the first not yet completed.
  const lesson = lessons.find((l) => l.id === current) ?? lessons.find((l) => l.id === c.resumeLessonId) ?? lessons.find((l) => !l.completed) ?? lessons[0];
  const idx = lesson ? lessons.indexOf(lesson) : -1;
  const pct = c.lessonCount ? Math.round((c.completedCount / c.lessonCount) * 100) : 0;

  const mark = (lessonId: string, completed: boolean) => {
    if (!token) return;
    setDone({ token, lessonId: lessonId as Id<"lessons">, completed }).catch(() => {});
    if (!completed) return;
    setJustDone(lessonId);
    // Celebrate finishing a section (or the whole course) with a ticket toast.
    const others = lessons.filter((l) => l.id !== lessonId);
    const sec = c.sections.find((s) => s.lessons.some((l) => l.id === lessonId));
    if (others.every((l) => l.completed)) ticket("🎓 Course complete!", `You finished ${c.title}`);
    else if (sec && sec.lessons.every((l) => l.id === lessonId || l.completed)) ticket("★ Section complete!", sec.title);
  };
  const next = () => {
    if (!lesson || idx >= lessons.length - 1) return;
    if (!lesson.completed) mark(lesson.id, true); // finishing a lesson by moving on counts it as done
    setCurrent(lessons[idx + 1].id);
  };

  return (
    <div className="course-layout" style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 40px 60px" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.muted, marginBottom: 6 }}>
          <Link href="/my-courses">My learning</Link> › {c.title}
        </div>
        {lesson ? (
          <>
            <VideoPlayer key={lesson.id} kind="lesson" id={lesson.id} style={{ borderRadius: 22 }} />
            <div style={{ font: `800 28px/1.2 ${DISPLAY}`, letterSpacing: "-.02em", margin: "18px 0 6px" }}>{lesson.title}</div>
            <div style={{ color: T.muted, fontSize: 14 }}>
              Lesson {idx + 1} of {lessons.length} · {c.instructorName}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button disabled={idx <= 0} onClick={() => setCurrent(lessons[idx - 1].id)} className="btn-hover" style={navBtn(idx <= 0)}>← Previous</button>
              <button
                onClick={() => mark(lesson.id, !lesson.completed)}
                className="btn-hover"
                style={{ ...navBtn(false), background: lesson.completed ? "oklch(0.9 0.08 150)" : T.orange }}
              >
                {lesson.completed ? "✓ Completed" : "Mark as complete"}
              </button>
              <button disabled={idx >= lessons.length - 1} onClick={next} className="btn-hover" style={navBtn(idx >= lessons.length - 1)}>Next <span className="arr">→</span></button>
            </div>
          </>
        ) : (
          <div style={{ background: "#fff", borderRadius: 28, padding: 50, textAlign: "center", color: T.muted }}>The instructor hasn’t published any lessons yet.</div>
        )}
      </div>

      <div className="course-buy" style={{ background: "#fff", borderRadius: 28, padding: 18, maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
        <div style={{ font: `800 20px ${DISPLAY}`, margin: "4px 6px 8px" }}>Course content</div>
        <div style={{ margin: "0 6px 14px" }}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>
            {c.completedCount} of {c.lessonCount} lessons completed · {pct}%
          </div>
          <div style={{ height: 8, borderRadius: 99, background: T.bg, overflow: "hidden" }}>
            <div className="spring-bar" style={{ width: `${pct}%`, height: "100%", background: T.orange, borderRadius: 99 }} />
          </div>
        </div>
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
                  {/* Finished lessons are stamped; the current one breathes; the rest are empty slots */}
                  {l.completed ? (
                    <span aria-label="Completed" className={`stamp-mark${l.id === justDone ? " new" : ""}`}>✓</span>
                  ) : (
                    <span className={`slot-dot${on ? " cur" : ""}`} aria-hidden>{on ? "▶" : lessons.indexOf(l) + 1}</span>
                  )}
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
