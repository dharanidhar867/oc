"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { money } from "@/lib/data";
import { fmtDuration } from "@/lib/upload";
import { DISPLAY, T } from "@/lib/theme";
import { errorMessage } from "@/lib/upload";
import { useAuth } from "../auth";
import VideoPlayer from "../VideoPlayer";

const card: React.CSSProperties = { background: "#fff", borderRadius: 28, padding: 26 };
const h2: React.CSSProperties = { font: `800 24px ${DISPLAY}`, letterSpacing: "-.02em", marginBottom: 14 };

const mins = (s: number) => Math.max(1, Math.round(s / 60));
const length = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${mins(s)} min`);

/** Public page for a course an admin approved: promo, what you get, outline, and buy buttons. */
export default function LiveCourseView({ id }: { id: string }) {
  const c = useQuery(api.catalog.getLive, { id });
  const { user, token, ready } = useAuth();
  const myCart = useQuery(api.cart.list, token ? { token } : "skip");
  const owned = useQuery(api.learning.ownsCourse, token ? { token, courseId: id } : "skip") === true;
  const addM = useMutation(api.cart.add);
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [openSec, setOpenSec] = useState<Set<string>>(new Set());

  if (c === undefined) return <div style={{ minHeight: "60vh" }} />;
  if (c === null)
    return (
      <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 40px", textAlign: "center" }}>
        <div style={{ font: `800 28px ${DISPLAY}` }}>This course isn’t available</div>
        <div style={{ color: T.muted2, margin: "10px 0 20px" }}>It may have been unpublished or the link is wrong.</div>
        <Link href="/courses" style={{ fontWeight: 700 }}>Browse courses →</Link>
      </div>
    );

  const inCart = !!myCart?.some((x) => x.id === c.id);
  const goCart = () => router.push("/cart");
  // Buying needs an account. Guests are sent to log in and come straight back here; the server re-checks the login on every cart call.
  const needLogin = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);
  const add = async (thenCart: boolean) => {
    setErr("");
    if (!ready) return;
    if (!user || !token) return needLogin();
    setBusy(true);
    try {
      await addM({ token, courseId: c.id as Id<"submissions"> });
      if (thenCart) goCart();
    } catch (e) {
      setErr(errorMessage(e, "Couldn’t add this course. Please try again."));
    }
    setBusy(false);
  };
  const toggle = (sid: string) =>
    setOpenSec((p) => {
      const n = new Set(p);
      if (!n.delete(sid)) n.add(sid);
      return n;
    });
  const allOpen = c.sections.length > 0 && openSec.size === c.sections.length;

  const facts: [string, string][] = [
    ["🎬", `${c.lessonCount} video lesson${c.lessonCount === 1 ? "" : "s"}`],
    ["⏱", `${length(c.totalSeconds)} of content`],
    ["📚", `${c.sections.length} section${c.sections.length === 1 ? "" : "s"}`],
    ["🎯", `${c.level} level`],
    ["♾️", "Lifetime access"],
    ["📱", "Watch on any device"],
  ];

  const canBuy = !user || user.role === "student"; // guests are sent to log in; instructors and admins never see buy buttons
  const buy = owned ? (
    <>
      <div style={{ font: `800 22px ${DISPLAY}`, margin: "16px 0 12px" }}>✓ You own this course</div>
      <Link href={`/learn/${c.id}`} className="nl btn-hover" style={{ display: "block", textAlign: "center", background: T.purple, color: "#fff", borderRadius: 99, padding: 16, fontWeight: 800, fontSize: 16 }}>
        Go to course
      </Link>
    </>
  ) : !canBuy ? (
    <>
      <div style={{ font: `800 38px ${DISPLAY}`, margin: "16px 0 14px" }}>{c.price === 0 ? "Free" : money(c.price)}</div>
      <div style={{ background: T.bg, borderRadius: 16, padding: 14, fontSize: 14, lineHeight: 1.5, color: T.body }}>
        {user?.role === "instructor"
          ? "Instructor accounts are for teaching, so courses can’t be bought here. To learn, sign up with a separate student account."
          : "Admin accounts can’t buy courses."}
      </div>
    </>
  ) : (
    <>
      <div style={{ font: `800 38px ${DISPLAY}`, margin: "16px 0 14px" }}>{c.price === 0 ? "Free" : money(c.price)}</div>
      <button
        onClick={inCart ? goCart : () => add(false)}
        disabled={busy}
        className="btn-hover"
        style={{ width: "100%", border: 0, background: T.purple, color: "#fff", borderRadius: 99, padding: 16, fontWeight: 800, fontSize: 16, fontFamily: "inherit", cursor: "pointer" }}
      >
        {inCart ? "Go to cart" : "Add to cart"}
      </button>
      <button
        onClick={() => (inCart ? goCart() : add(true))}
        disabled={busy}
        className="btn-hover"
        style={{ width: "100%", marginTop: 10, border: `2px solid ${T.ink}`, background: "#fff", color: T.ink, borderRadius: 99, padding: 14, fontWeight: 800, fontSize: 16, fontFamily: "inherit", cursor: "pointer" }}
      >
        Buy now
      </button>
      {!user && ready && <div style={{ fontSize: 13, color: T.muted, textAlign: "center", marginTop: 10 }}>You’ll be asked to log in or sign up first.</div>}
      {err && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 10 }}>{err}</div>}
    </>
  );

  return (
    <div>
      {/* Hero */}
      <div style={{ background: T.deep, color: "#fff" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "34px 40px 40px" }}>
          <div style={{ maxWidth: 820 }}>
            <div style={{ fontSize: 14, color: "oklch(0.85 0.08 300)" }}>
              <Link href="/courses">Courses</Link> › <Link href={`/courses?category=${encodeURIComponent(c.category)}`}>{c.category}</Link>
            </div>
            <div style={{ font: `800 46px/1.05 ${DISPLAY}`, letterSpacing: "-.03em", margin: "14px 0 12px" }}>{c.title}</div>
            {c.subtitle && <div style={{ fontSize: 19, lineHeight: 1.45, color: "oklch(0.92 0.04 300)" }}>{c.subtitle}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20, fontSize: 14, fontWeight: 700 }}>
              {[c.level, `${c.lessonCount} lesson${c.lessonCount === 1 ? "" : "s"}`, length(c.totalSeconds)].map((t) => (
                <span key={t} style={{ background: "oklch(0.38 0.1 300)", padding: "6px 14px", borderRadius: 99 }}>{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 15, marginTop: 16 }}>
              Created by <b style={{ color: "oklch(0.88 0.1 300)" }}>{c.instructorName}</b>
              {c.instructor.headline && <span style={{ color: "oklch(0.88 0.04 300)" }}> · {c.instructor.headline}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="course-layout" style={{ maxWidth: 1360, margin: "0 auto", padding: "30px 40px 70px" }}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* What you get */}
          <div style={card}>
            <div style={h2}>What you’ll get</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
              {facts.map(([icon, text]) => (
                <div key={text} style={{ display: "flex", gap: 12, alignItems: "center", background: T.bg, borderRadius: 18, padding: "14px 16px", fontWeight: 700, fontSize: 15 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Course content */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={h2}>Course content</div>
              {c.sections.length > 0 && (
                <button
                  onClick={() => setOpenSec(allOpen ? new Set() : new Set(c.sections.map((s) => s.id)))}
                  style={{ background: "none", border: 0, color: T.purple, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              )}
            </div>
            <div style={{ fontSize: 14, color: T.muted, margin: "-6px 0 14px" }}>
              {c.sections.length} section{c.sections.length === 1 ? "" : "s"} · {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"} · {length(c.totalSeconds)} total ·{" "}
              {owned ? "✓ all lessons unlocked" : "🔒 lessons unlock when you buy the course; the preview video is free"}
            </div>
            <div style={{ border: `1.5px solid ${T.line}`, borderRadius: 20, overflow: "hidden" }}>
              {c.sections.map((s, i) => {
                const open = openSec.has(s.id);
                const secs = s.lessons.reduce((n, l) => n + l.duration, 0);
                return (
                  <div key={s.id} style={{ borderTop: i ? `1.5px solid ${T.line}` : undefined }}>
                    <button
                      onClick={() => toggle(s.id)}
                      aria-expanded={open}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", background: open ? T.bg : "#fff", border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", fontSize: 16 }}
                    >
                      <span style={{ fontWeight: 800, transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>›</span>
                      <b style={{ flex: 1 }}>{s.title}</b>
                      <span style={{ fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>{s.lessons.length} lesson{s.lessons.length === 1 ? "" : "s"} · {length(secs)}</span>
                    </button>
                    {open &&
                      s.lessons.map((l) => (
                        <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 18px 12px 44px", borderTop: `1px solid ${T.line}`, fontSize: 15 }}>
                          <span aria-hidden title={owned ? "Unlocked" : "Unlocks when you buy the course"}>{owned ? "▶" : "🔒"}</span>
                          <span style={{ flex: 1 }}>{l.title}</span>
                          <span style={{ color: T.muted }}>{fmtDuration(l.duration)}</span>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* About */}
          <div style={card}>
            <div style={h2}>About this course</div>
            <div style={{ lineHeight: 1.75, fontSize: 16, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.description}</div>
          </div>

          {/* Instructor */}
          <div style={card}>
            <div style={h2}>Your instructor</div>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ width: 76, height: 76, borderRadius: "50%", background: T.purple, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: `800 32px ${DISPLAY}`, flex: "none" }}>
                {c.instructor.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 21, letterSpacing: "-.01em" }}>{c.instructor.name}</div>
                {c.instructor.headline && <div style={{ color: T.purple, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{c.instructor.headline}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
                  <span style={{ background: T.bg, borderRadius: 99, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}>
                    {c.instructor.liveCourses} course{c.instructor.liveCourses === 1 ? "" : "s"} on QuickAI
                  </span>
                  <span style={{ background: T.bg, borderRadius: 99, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}>✓ Approved by our team</span>
                </div>
                {c.instructor.teaches && (
                  <div style={{ fontSize: 15, marginBottom: 8 }}>
                    <b>Teaches:</b> {c.instructor.teaches}
                  </div>
                )}
                {c.instructor.bio && (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10 }}>Experience & qualifications</div>
                    <div style={{ lineHeight: 1.7, fontSize: 15, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: T.body, marginTop: 4 }}>{c.instructor.bio}</div>
                  </>
                )}
                {c.instructor.link && (
                  <a
                    href={c.instructor.link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-hover"
                    style={{ display: "inline-block", marginTop: 14, border: `2px solid ${T.ink}`, borderRadius: 99, padding: "9px 18px", fontWeight: 800, fontSize: 14 }}
                  >
                    {/linkedin\.com/i.test(c.instructor.link) ? "View LinkedIn profile ↗" : "View profile / portfolio ↗"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Buy card */}
        <div className="course-buy" style={{ background: "#fff", borderRadius: 28, padding: 20, boxShadow: "0 10px 40px oklch(0.3 0.1 300 / .12)" }}>
          {c.promoUrl ? (
            <VideoPlayer src={c.promoUrl} style={{ borderRadius: 18 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumbnail} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 18, display: "block" }} />
          )}
          <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>Watch the free preview</div>
          {buy}
          <div style={{ marginTop: 18, fontSize: 14, lineHeight: 1.9, color: T.body }}>
            <div style={{ fontWeight: 800, color: T.ink, marginBottom: 2 }}>This course includes</div>
            {facts.slice(0, 2).concat([facts[4]]).map(([icon, text]) => (
              <div key={text}>{icon} {text}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
