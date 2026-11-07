"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DISPLAY, T } from "@/lib/theme";
import { MAX_LESSON_MIN, MAX_VIDEO_MB, errorMessage, fmtDuration, readDuration, uploadToGumlet, videoProblem } from "@/lib/upload";
import { useAuth } from "../auth";
import { StatusBadge } from "../StatusBadge";
import VideoPlayer from "../VideoPlayer";

// These mirror convex/limits.ts for display only; the server enforces them.
const MIN_LESSONS = 1;

const box: React.CSSProperties = { background: "#fff", borderRadius: 26, padding: 22, marginBottom: 16 };
const input: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.03 300)", fontSize: 14, fontFamily: "inherit" };
const small: React.CSSProperties = { fontWeight: 700, fontSize: 13, cursor: "pointer", background: "none", border: 0, fontFamily: "inherit", padding: 0 };

const LESSON_COLOR = { pending: ["Awaiting review", T.yellow, T.ink], approved: ["Approved", "oklch(0.9 0.08 150)", "oklch(0.35 0.08 150)"], rejected: ["Needs changes", "oklch(0.93 0.05 20)", "oklch(0.4 0.15 20)"] } as const;

const errText = (e: unknown) => errorMessage(e);

function AddLesson({ sectionId, token, disabled }: { sectionId: string; token: string; disabled: boolean }) {
  const createUpload = useAction(api.uploads.createUpload);
  const addLesson = useMutation(api.lessons.addLesson);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [secs, setSecs] = useState(0);
  const [inputKey, setInputKey] = useState(0);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const s = await readDuration(f);
    const bad = videoProblem(f, MAX_LESSON_MIN * 60, s);
    setErr(bad ?? "");
    setFile(bad ? null : f);
    setSecs(bad ? 0 : s);
  };

  const submit = async () => {
    if (title.trim().length < 3) return setErr("Give the lesson a title (at least 3 characters).");
    if (!file) return setErr("Choose a video file.");
    setErr("");
    setStatus("Starting…");
    try {
      const { assetId, size } = await uploadToGumlet(file, () => createUpload({ token, kind: "lesson" }), setStatus);
      setStatus("Saving…");
      const r = await addLesson({ token, sectionId: sectionId as Id<"sections">, title, assetId, size, duration: secs });
      if (!r.ok) setErr(r.error);
      else {
        setTitle("");
        setFile(null);
        setSecs(0);
        setInputKey((k) => k + 1);
      }
    } catch (e) {
      setErr(errText(e));
    }
    setStatus(null);
  };

  return (
    <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 12, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" style={{ ...input, flex: "1 1 220px" }} disabled={disabled || status !== null} />
        <input key={inputKey} type="file" accept="video/mp4,video/webm" onChange={(e) => pick(e.target.files?.[0])} disabled={disabled || status !== null} />
        <button onClick={submit} disabled={disabled || status !== null} className="btn-hover" style={{ background: T.purple, color: "#fff", border: 0, borderRadius: 99, padding: "10px 20px", fontWeight: 800, fontSize: 14, fontFamily: "inherit", cursor: "pointer", opacity: disabled || status !== null ? 0.6 : 1 }}>
          {status !== null ? "Working…" : "Add lesson"}
        </button>
      </div>
      {status !== null && <div style={{ fontSize: 13, fontWeight: 700, color: T.purple, marginTop: 6 }}>{status}</div>}
      {file && <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{file.name} · {fmtDuration(secs)} · {(file.size / 1048576).toFixed(0)} MB</div>}
      <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>MP4 video · up to {MAX_LESSON_MIN} minutes · max {MAX_VIDEO_MB} MB · 2 lesson uploads per day. Keep this tab open until the upload finishes.</div>
      {err && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function ReplaceVideo({ lessonId, token }: { lessonId: string; token: string }) {
  const createUpload = useAction(api.uploads.createUpload);
  const replace = useMutation(api.lessons.replaceLessonVideo);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const s = await readDuration(f);
    const bad = videoProblem(f, MAX_LESSON_MIN * 60, s);
    if (bad) return setMsg(bad);
    setBusy("Starting…");
    setMsg("");
    try {
      const { assetId, size } = await uploadToGumlet(f, () => createUpload({ token, kind: "lesson" }), setBusy);
      setBusy("Saving…");
      const r = await replace({ token, lessonId: lessonId as Id<"lessons">, assetId, size, duration: s });
      if (!r.ok) setMsg(r.error);
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy(null);
  };
  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ fontSize: 13, fontWeight: 700 }}>
        {busy ?? "Replace video: "}
        {!busy && <input type="file" accept="video/mp4,video/webm" onChange={(e) => pick(e.target.files?.[0])} />}
      </label>
      {msg && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{msg}</div>}
    </div>
  );
}

export default function CourseEditor({ id }: { id: string }) {
  const { token } = useAuth();
  const course = useQuery(api.courses.get, token ? { token, id: id as Id<"submissions"> } : "skip");
  const addSection = useMutation(api.lessons.addSection);
  const removeSection = useMutation(api.lessons.removeSection);
  const removeLesson = useMutation(api.lessons.removeLesson);
  const submitM = useMutation(api.courses.submitForReview);
  const draftM = useMutation(api.courses.backToDraft);
  const [secTitle, setSecTitle] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const run = (p: Promise<unknown>) => p.then(() => setMsg("")).catch((e) => setMsg(errText(e)));

  if (!token) return null;
  if (course === undefined) return <div style={{ minHeight: "50vh" }} />;
  if (course === null)
    return (
      <div style={{ maxWidth: 820, margin: "40px auto", padding: "0 40px" }}>
        Course not found. <Link href="/instructor" style={{ fontWeight: 700 }}>← Instructor studio</Link>
      </div>
    );

  const editable = course.status === "draft" || course.status === "rejected";
  const isLive = course.status === "live";
  const canAdd = editable || isLive; // a live course can keep growing: new lessons wait for admin approval before students see them
  const ready = course.lessonCount >= MIN_LESSONS && course.rejected === 0 && course.sections.every((s) => s.lessons.length > 0);
  const tick = (ok: boolean) => <span style={{ color: ok ? "oklch(0.5 0.15 150)" : T.muted }}>{ok ? "✓" : "○"}</span>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "10px 40px 60px" }}>
      <Link href="/instructor" style={{ fontSize: 14, fontWeight: 700 }}>← Instructor studio</Link>
      <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "10px 0 6px", flexWrap: "wrap" }}>
        <div style={{ font: `800 36px ${DISPLAY}`, letterSpacing: "-.03em" }}>{course.title}</div>
        <StatusBadge status={course.status} />
      </div>
      <div style={{ color: T.muted2, marginBottom: 18 }}>
        {isLive
          ? "This course is live. Add new sections and lesson videos any time. Students only see a new lesson after our team approves it."
          : "Step 2 of 2: add sections and lesson videos. Our team reviews every lesson before the course goes live."}
      </div>

      {course.reason && (course.status === "rejected" || course.status === "taken_down") && (
        <div style={{ ...box, background: "oklch(0.95 0.04 20)", color: "oklch(0.4 0.15 20)", fontWeight: 600 }}>Feedback from our team: {course.reason}</div>
      )}
      {msg && <div role="alert" style={{ ...box, color: T.danger, fontWeight: 700 }}>{msg}</div>}

      <div style={box}>
        <div style={{ font: `800 18px ${DISPLAY}`, marginBottom: 10 }}>Promo video</div>
        {course.hasPromo ? <VideoPlayer kind="promo" id={course.id} style={{ maxWidth: 560, borderRadius: 16 }} /> : <div style={{ color: T.muted }}>No promo video.</div>}
      </div>

      {editable && <div style={box}>
        <div style={{ font: `800 18px ${DISPLAY}`, marginBottom: 8 }}>Before you can submit</div>
        <div style={{ lineHeight: 1.8, fontSize: 14 }}>
          <div>{tick(course.lessonCount >= MIN_LESSONS)} At least {MIN_LESSONS} lesson uploaded ({course.lessonCount} so far)</div>
          <div>{tick(course.rejected === 0)} No lessons waiting for a replacement video</div>
          <div>{tick(course.sections.length > 0 && course.sections.every((s) => s.lessons.length > 0))} Every section has at least one lesson</div>
        </div>
      </div>}

      {course.sections.map((sec) => (
        <div key={sec.id} style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ font: `800 18px ${DISPLAY}` }}>{sec.title}</div>
            {editable && (
              <button style={{ ...small, color: T.danger }} onClick={() => confirm(`Delete “${sec.title}” and its ${sec.lessons.length} lesson(s)?`) && run(removeSection({ token, sectionId: sec.id as Id<"sections"> }))}>
                Delete section
              </button>
            )}
          </div>
          {sec.lessons.map((l) => {
            const [label, bg, fg] = LESSON_COLOR[l.status];
            return (
              <div key={l.id} style={{ padding: "12px 0", borderTop: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ flex: "1 1 200px" }}>{l.title}</b>
                  <span style={{ fontSize: 13, color: T.muted }}>{fmtDuration(l.duration)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, background: bg, color: fg, padding: "3px 10px", borderRadius: 99 }}>{label}</span>
                  <button style={{ ...small, color: T.purple }} onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Watch"}</button>
                  {(editable || (isLive && l.status !== "approved")) && <button style={{ ...small, color: T.danger }} onClick={() => confirm("Delete this lesson?") && run(removeLesson({ token, lessonId: l.id as Id<"lessons"> }))}>Delete</button>}
                </div>
                {l.status === "rejected" && l.reason && <div style={{ color: "oklch(0.45 0.15 20)", fontSize: 13, fontWeight: 600, marginTop: 6 }}>Reason: {l.reason}</div>}
                {open === l.id && l.hasVideo && <VideoPlayer kind="lesson" id={l.id} style={{ maxWidth: 560, marginTop: 10 }} />}
                {canAdd && l.status === "rejected" && <ReplaceVideo lessonId={l.id} token={token} />}
              </div>
            );
          })}
          {sec.lessons.length === 0 && <div style={{ color: T.muted, fontSize: 14, padding: "10px 0" }}>No lessons yet.</div>}
          {canAdd && <AddLesson sectionId={sec.id} token={token} disabled={false} />}
        </div>
      ))}

      {canAdd && (
        <div style={{ ...box, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={secTitle} onChange={(e) => setSecTitle(e.target.value)} placeholder="New section title, e.g. Getting started" style={{ ...input, flex: "1 1 260px" }} />
          <button
            className="btn-hover"
            onClick={() => run(addSection({ token, courseId: id as Id<"submissions">, title: secTitle }).then(() => setSecTitle("")))}
            style={{ border: `2px solid ${T.ink}`, background: "#fff", borderRadius: 99, padding: "10px 20px", fontWeight: 800, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}
          >
            + Add section
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {editable && (
          <button
            onClick={() => run(submitM({ token, id: id as Id<"submissions"> }))}
            disabled={!ready}
            className="btn-hover"
            style={{ border: 0, background: T.purple, color: "#fff", borderRadius: 99, padding: "14px 28px", fontWeight: 800, fontSize: 15, fontFamily: "inherit", cursor: ready ? "pointer" : "not-allowed", opacity: ready ? 1 : 0.5 }}
          >
            Submit for review
          </button>
        )}
        {course.status === "in_review" && (
          <>
            <span style={{ color: T.muted2 }}>Under review — lessons are locked while our team watches them.</span>
            <button style={{ ...small, color: T.muted }} onClick={() => run(draftM({ token, id: id as Id<"submissions"> }))}>Withdraw to edit</button>
          </>
        )}
        {isLive && <span style={{ color: T.muted2 }}>{course.pending > 0 ? `${course.pending} new lesson${course.pending === 1 ? " is" : "s are"} waiting for approval.` : "This course is live."}</span>}
      </div>
    </div>
  );
}
