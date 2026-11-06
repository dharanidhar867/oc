"use client";

import { useState } from "react";
import { money } from "@/lib/data";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import { StatusBadge } from "../StatusBadge";

type Tab = "applications" | "courses" | "live" | "instructors" | "audit";

const when = (t: number) => new Date(t).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const card: React.CSSProperties = { background: "#fff", borderRadius: 26, padding: 22, marginBottom: 14 };

function Btn({ children, onClick, tone = "ink", disabled }: { children: React.ReactNode; onClick: () => void; tone?: "ink" | "green" | "red" | "ghost"; disabled?: boolean }) {
  const t = {
    ink: { background: T.ink, color: "#fff", border: 0 },
    green: { background: T.purple, color: "#fff", border: 0 },
    red: { background: "#fff", color: T.danger, border: `2px solid ${T.danger}` },
    ghost: { background: "#fff", color: T.ink, border: `2px solid ${T.ink}` },
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} className="btn-hover" style={{ ...t, borderRadius: 99, padding: "10px 20px", fontWeight: 800, fontSize: 14, fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

/** Approve / Reject (with required reason) action row. */
function Decision({ approveLabel, rejectLabel = "Reject", onApprove, onReject }: { approveLabel: string; rejectLabel?: string; onApprove: () => void; onReject: (reason: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  if (!rejecting) {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <Btn tone="green" onClick={onApprove}>
          {approveLabel}
        </Btn>
        <Btn tone="red" onClick={() => setRejecting(true)}>
          {rejectLabel}…
        </Btn>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14 }}>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Reason (shown to the instructor) — required"
        className="field"
        style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: `1.5px solid ${err ? T.danger : "oklch(0.88 0.03 300)"}`, fontSize: 14, fontFamily: "inherit", outline: 0 }}
      />
      {err && <div style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <Btn
          tone="red"
          onClick={() => {
            if (reason.trim().length < 5) return setErr("Please give a short reason (at least 5 characters).");
            onReject(reason.trim());
          }}
        >
          Confirm {rejectLabel.toLowerCase()}
        </Btn>
        <Btn tone="ghost" onClick={() => setRejecting(false)}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

/** Watch every lesson and approve/reject it individually. A course can only be published when all are approved. */
function LessonReview({ courseId }: { courseId: string }) {
  const { token } = useAuth();
  const data = useQuery(api.admin.getCourseForReview, token ? { token, id: courseId as Id<"submissions"> } : "skip");
  const decide = useMutation(api.admin.decideLesson);
  const [playing, setPlaying] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  if (!data) return <div style={{ color: T.muted, fontSize: 14, marginTop: 12 }}>Loading lessons…</div>;
  const go = (lessonId: string, decision: "approved" | "rejected", r?: string) => {
    setErr("");
    decide({ token: token!, lessonId: lessonId as Id<"lessons">, decision, reason: r })
      .then(() => { setRejecting(null); setReason(""); })
      .catch((e) => setErr(typeof e?.data === "string" ? e.data : "Something went wrong."));
  };
  const mm = (n: number) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;
  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        Lessons: {data.approved}/{data.lessonCount} approved · {Math.floor(data.totalSeconds / 60)} min total
      </div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>Watch each lesson — the promo is only a preview and doesn’t count.</div>
      {err && <div style={{ color: T.danger, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{err}</div>}
      {data.promoUrl && (
        <div style={{ marginBottom: 10 }}>
          <span onClick={() => setPlaying(playing === "promo" ? null : "promo")} style={{ fontWeight: 700, fontSize: 13, cursor: "pointer", color: T.purple }}>{playing === "promo" ? "Hide" : "Watch"} promo</span>
          {playing === "promo" && <video src={data.promoUrl} controls preload="metadata" style={{ display: "block", width: "100%", maxWidth: 520, borderRadius: 12, marginTop: 6, background: "#000" }} />}
        </div>
      )}
      {data.sections.map((sec) => (
        <div key={sec.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{sec.title}</div>
          {sec.lessons.map((l) => (
            <div key={l.id} style={{ padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 200px" }}>{l.title} <span style={{ color: T.muted, fontSize: 13 }}>· {mm(l.duration)} · {(l.size / 1048576).toFixed(0)} MB</span></span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: l.status === "approved" ? "oklch(0.9 0.08 150)" : l.status === "rejected" ? "oklch(0.93 0.05 20)" : T.yellow }}>{l.status}</span>
                <span onClick={() => setPlaying(playing === l.id ? null : l.id)} style={{ fontWeight: 700, fontSize: 13, cursor: "pointer", color: T.purple }}>{playing === l.id ? "Hide" : "Watch"}</span>
                {l.status !== "approved" && <Btn tone="green" onClick={() => go(l.id, "approved")}>Approve</Btn>}
                {l.status !== "rejected" && <Btn tone="red" onClick={() => setRejecting(rejecting === l.id ? null : l.id)}>Reject…</Btn>}
              </div>
              {l.status === "rejected" && l.reason && <div style={{ fontSize: 13, color: T.danger, marginTop: 4 }}>Rejected: {l.reason}</div>}
              {playing === l.id && l.videoUrl && <video src={l.videoUrl} controls preload="metadata" style={{ display: "block", width: "100%", maxWidth: 520, borderRadius: 12, marginTop: 6, background: "#000" }} />}
              {rejecting === l.id && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the instructor" style={{ flex: 1, padding: "8px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.03 300)", fontFamily: "inherit" }} />
                  <Btn tone="red" onClick={() => (reason.trim().length < 5 ? setErr("Give a reason (at least 5 characters).") : go(l.id, "rejected", reason.trim()))}>Confirm</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {data.rejected > 0 && <div style={{ fontSize: 13, color: T.muted2 }}>When you’re done, use “Reject…” below to send the course back so the instructor can replace the rejected lessons.</div>}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <div style={{ ...card, textAlign: "center", color: T.muted, padding: 44 }}>{children}</div>;

export default function AdminConsole() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("applications");
  const [err, setErr] = useState("");
  const t = token ? { token } : ("skip" as const);

  // Every query/mutation is authorised by Convex against the caller’s session; non-admins get an error.
  const apps = useQuery(api.admin.listInstructors, token ? { token, status: "pending" } : "skip") ?? [];
  const inReview = useQuery(api.admin.listSubmissions, token ? { token, status: "in_review" } : "skip") ?? [];
  const live = useQuery(api.admin.listSubmissions, token ? { token, status: "live" } : "skip") ?? [];
  const instructors = (useQuery(api.admin.listInstructors, t) ?? []).filter((i) => i.status !== "pending");
  const audit = useQuery(api.admin.listAudit, t) ?? [];

  const decideApplicationM = useMutation(api.admin.decideApplication);
  const decideCourseM = useMutation(api.admin.decideCourse);
  const takeDownM = useMutation(api.admin.takeDown);
  const setSuspendedM = useMutation(api.admin.setSuspended);
  const run = (p: Promise<unknown>) => {
    setErr("");
    p.catch((e) => setErr(e?.data ?? "Something went wrong."));
  };
  const decideApplication = (id: string, d: "approved" | "rejected", reason?: string) =>
    token && run(decideApplicationM({ token, userId: id as Id<"users">, decision: d, reason }));
  const decideCourse = (id: string, d: "live" | "rejected", reason?: string) =>
    token && run(decideCourseM({ token, id: id as Id<"submissions">, decision: d, reason }));
  const takeDown = (id: string, reason: string) => token && run(takeDownM({ token, id: id as Id<"submissions">, reason }));
  const setSuspended = (id: string, suspended: boolean) => token && run(setSuspendedM({ token, userId: id as Id<"users">, suspended }));

  const tabs: [Tab, string, number | null][] = [
    ["applications", "Applications", apps.length],
    ["courses", "Course review", inReview.length],
    ["live", "Live courses", live.length],
    ["instructors", "Instructors", null],
    ["audit", "Audit log", null],
  ];

  return (
    <div>
      <div style={{ background: "#14101f", color: "#fff" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "36px 40px 0" }}>
          <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em" }}>Admin console</div>
          <div style={{ color: "oklch(0.8 0.05 300)", marginTop: 4 }}>Review instructors and courses before they reach learners.</div>
          <div style={{ display: "flex", gap: 28, marginTop: 26, fontWeight: 700, overflowX: "auto" }}>
            {tabs.map(([k, n, count]) => (
              <span
                key={k}
                onClick={() => setTab(k)}
                style={{ paddingBottom: 14, cursor: "pointer", whiteSpace: "nowrap", borderBottom: `3px solid ${tab === k ? T.orange : "transparent"}`, color: tab === k ? "#fff" : "oklch(0.8 0.05 300)" }}
              >
                {n}
                {count ? <span style={{ marginLeft: 8, background: T.orange, color: T.ink, borderRadius: 99, padding: "1px 9px", fontSize: 12 }}>{count}</span> : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 40px 60px" }}>
        {err && <div style={{ ...card, color: T.danger, fontWeight: 700 }}>{err}</div>}
        {tab === "applications" &&
          (apps.length === 0 ? (
            <Empty>No pending applications. 🎉</Empty>
          ) : (
            apps.map((u) => (
              <div key={u.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ font: `800 20px ${DISPLAY}` }}>{u.name}</div>
                    <div style={{ color: T.muted, fontSize: 14 }}>{u.email}</div>
                  </div>
                  <div style={{ fontSize: 13, color: T.muted }}>Applied {u.application ? when(u.application.submittedAt) : when(u.createdAt)}</div>
                </div>
                {u.application && (
                  <div style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, color: T.body }}>
                    <div>
                      <b>Headline:</b> {u.application.headline}
                    </div>
                    <div>
                      <b>Wants to teach:</b> {u.application.teaches}
                    </div>
                    <div>
                      <b>Experience:</b> {u.application.bio}
                    </div>
                    {u.application.link && (
                      <div>
                        <b>Link:</b>{" "}
                        <a href={u.application.link} target="_blank" rel="noopener noreferrer nofollow">
                          {u.application.link}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <Decision approveLabel="Approve instructor" onApprove={() => decideApplication(u.id, "approved")} onReject={(r) => decideApplication(u.id, "rejected", r)} />
              </div>
            ))
          ))}

        {tab === "courses" &&
          (inReview.length === 0 ? (
            <Empty>Nothing waiting for review.</Empty>
          ) : (
            inReview.map((s) => (
              <div key={s.id} style={card}>
                <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbnail} alt="Course image to review" style={{ width: 240, height: 135, objectFit: "cover", borderRadius: 16 }} />
                  <div>
                    <div style={{ font: `800 20px ${DISPLAY}` }}>{s.title}</div>
                    <div style={{ color: T.muted2, fontSize: 14, margin: "2px 0 6px" }}>{s.subtitle}</div>
                    <div style={{ fontSize: 13, color: T.muted }}>
                      By {s.instructorName} · {s.category} · {s.level} · {money(s.price)} · submitted {when(s.updatedAt)}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 8, color: T.body }}>{s.description}</div>
                  </div>
                </div>
                <LessonReview courseId={s.id} />
                <Decision approveLabel="Approve & publish" onApprove={() => decideCourse(s.id, "live")} onReject={(r) => decideCourse(s.id, "rejected", r)} />
              </div>
            ))
          ))}

        {tab === "live" &&
          (live.length === 0 ? (
            <Empty>No live instructor courses yet.</Empty>
          ) : (
            live.map((s) => (
              <div key={s.id} style={card}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbnail} alt="" style={{ width: 96, height: 54, objectFit: "cover", borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <b>{s.title}</b>
                    <div style={{ fontSize: 13, color: T.muted }}>
                      {s.instructorName} · {s.category}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <Decision approveLabel="Keep live" rejectLabel="Take down" onApprove={() => {}} onReject={(r) => takeDown(s.id, r)} />
              </div>
            ))
          ))}

        {tab === "instructors" &&
          (instructors.length === 0 ? (
            <Empty>No instructors yet.</Empty>
          ) : (
            instructors.map((u) => (
              <div key={u.id} style={{ ...card, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <b>{u.name}</b>
                  <div style={{ fontSize: 13, color: T.muted }}>{u.email}</div>
                  {u.rejectionReason && <div style={{ fontSize: 13, color: T.danger, marginTop: 4 }}>Rejected: {u.rejectionReason}</div>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, background: u.status === "approved" ? "oklch(0.9 0.08 150)" : "oklch(0.93 0.05 20)", padding: "3px 10px", borderRadius: 99, textTransform: "capitalize" }}>{u.status}</span>
                {u.status === "approved" && (
                  <Btn tone="red" onClick={() => confirm(`Suspend ${u.name}? Their live courses will be taken down.`) && setSuspended(u.id, true)}>
                    Suspend
                  </Btn>
                )}
                {u.status === "suspended" && (
                  <Btn tone="ghost" onClick={() => setSuspended(u.id, false)}>
                    Reinstate
                  </Btn>
                )}
                {u.status === "rejected" && (
                  <Btn tone="ghost" onClick={() => decideApplication(u.id, "approved")}>
                    Approve now
                  </Btn>
                )}
              </div>
            ))
          ))}

        {tab === "audit" &&
          (audit.length === 0 ? (
            <Empty>No admin actions recorded yet.</Empty>
          ) : (
            <div style={card}>
              {audit.map((a, i) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "180px 140px 1fr", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${T.line}` : 0, fontSize: 14 }}>
                  <span style={{ color: T.muted }}>{when(a.at)}</span>
                  <b>{a.admin}</b>
                  <span>
                    {a.action} — <span style={{ color: T.muted2 }}>{a.target}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
