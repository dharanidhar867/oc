"use client";

import Link from "next/link";
import { money } from "@/lib/data";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Submission } from "@/lib/moderation";
import { pastel, DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import { StatusBadge } from "../StatusBadge";

const link: React.CSSProperties = { fontWeight: 700, fontSize: 13, cursor: "pointer" };

export default function TeachView() {
  const { token } = useAuth();
  // Server returns only this instructor’s courses (owner comes from the session); updates live when an admin decides.
  const mine = (useQuery(api.courses.listMine, token ? { token } : "skip") ?? []) as (Submission & { lessonCount: number })[];
  const submitM = useMutation(api.courses.submitForReview);
  const draftM = useMutation(api.courses.backToDraft);
  const removeM = useMutation(api.courses.remove);
  const act = (f: typeof submitM | typeof draftM | typeof removeM, id: string) => token && f({ token, id: id as Id<"submissions"> }).catch((e) => alert(e?.data ?? "Something went wrong."));
  const submitForReview = (id: string) => act(submitM, id);
  const backToDraft = (id: string) => act(draftM, id);
  const deleteSubmission = (id: string) => act(removeM, id);

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "10px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 24px" }}>
        <div style={{ font: `800 46px ${DISPLAY}`, letterSpacing: "-.03em" }}>Instructor studio</div>
        <Link href="/instructor/course/new" className="nl btn-hover" style={{ background: T.purple, color: "#fff", fontWeight: 700, padding: "14px 26px", borderRadius: 99 }}>
          + New course
        </Link>
      </div>

      {/* Your submissions (review workflow) */}
      <div style={{ background: "#fff", borderRadius: 28, padding: "22px 26px", marginBottom: 20 }}>
        <div style={{ font: `800 20px ${DISPLAY}` }}>Your courses</div>
        <div style={{ color: T.muted, fontSize: 14, margin: "4px 0 10px" }}>Every course is reviewed by our team before it goes live.</div>
        {mine.length === 0 ? (
          <div style={{ padding: "26px 0", textAlign: "center", color: T.muted }}>
            You haven’t created a course yet.{" "}
            <Link href="/instructor/course/new" style={{ fontWeight: 700 }}>
              Create your first course →
            </Link>
          </div>
        ) : (
          mine.map((s) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "72px 1fr auto auto", gap: 16, alignItems: "center", padding: "14px 0", borderTop: `1px solid ${T.line}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.thumbnail} alt="" style={{ width: 72, height: 44, objectFit: "cover", borderRadius: 10, background: pastel(300, 0.88, 0.09) }} />
              <div>
                <b>{s.title}</b>
                <div style={{ fontSize: 13, color: T.muted }}>
                  {s.category} · {s.level} · {money(s.price)} · {s.lessonCount} lesson{s.lessonCount === 1 ? "" : "s"}
                </div>
                {s.reason && (s.status === "rejected" || s.status === "taken_down") && (
                  <div style={{ fontSize: 13, color: "oklch(0.45 0.15 20)", fontWeight: 600, marginTop: 4 }}>Reason: {s.reason}</div>
                )}
              </div>
              <StatusBadge status={s.status} />
              <div style={{ display: "flex", gap: 14 }}>
                <Link href={`/instructor/course/${s.id}`} className="nl" style={{ ...link, color: T.purple }}>
                  {s.status === "draft" || s.status === "rejected" ? "Edit lessons" : "View"}
                </Link>
                {s.status === "draft" && (
                  <span onClick={() => submitForReview(s.id)} style={{ ...link, color: T.purple }}>
                    Submit for review
                  </span>
                )}
                {s.status === "in_review" && (
                  <span onClick={() => backToDraft(s.id)} style={{ ...link, color: T.muted }}>
                    Withdraw
                  </span>
                )}
                {s.status === "rejected" && (
                  <span onClick={() => backToDraft(s.id)} style={{ ...link, color: T.purple }}>
                    Back to draft
                  </span>
                )}
                {s.status !== "live" && s.status !== "in_review" && (
                  <span
                    onClick={() => {
                      if (confirm("Delete this course?")) deleteSubmission(s.id);
                    }}
                    style={{ ...link, color: T.danger }}
                  >
                    Delete
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
