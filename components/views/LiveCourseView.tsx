"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { money } from "@/lib/data";
import { fmtDuration } from "@/lib/upload";
import { DISPLAY, MONO, T } from "@/lib/theme";
import { errorMessage } from "@/lib/upload";
import { useAuth } from "../auth";
import VideoPlayer from "../VideoPlayer";
import { flyToCart, ticket } from "../sticker-fx";

/** The price as a coin, with a plain "one-time payment" note and a money-back stamp beside it. */
function PriceTag({ price, guarantee = true }: { price: number; guarantee?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0 16px" }}>
      <div className="arc-coin" aria-label={price === 0 ? "Free" : `Price ${money(price)}`}>{price === 0 ? "Free" : money(price)}</div>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4, color: T.muted }}>
        {price === 0 ? "No payment needed" : "One-time payment"}
        <br />
        Lifetime access
      </div>
      {guarantee && price > 0 && (
        <div className="guarantee" style={{ width: 72, height: 72, fontSize: 9 }}>
          30-day
          <br />
          money
          <br />
          back
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 28, padding: 26 };
const h2: React.CSSProperties = { font: `800 25px ${DISPLAY}`, letterSpacing: "-.02em", marginBottom: 4 };
const hint: React.CSSProperties = { fontSize: 14, color: T.muted, margin: "0 0 16px" };

const mins = (s: number) => Math.max(1, Math.round(s / 60));
const length = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${mins(s)} min`);

/** Public page for a course an admin approved: promo, what you get, outline, and buy buttons. */
export default function LiveCourseView({ id }: { id: string }) {
  const c = useQuery(api.catalog.getLive, { id });
  const { user, token, ready } = useAuth();
  const myCart = useQuery(api.cart.list, token ? { token } : "skip");
  const owned = useQuery(api.learning.ownsCourse, token ? { token, courseId: id } : "skip") === true;
  // Progress only exists for students who own the course; the server returns null for everyone else.
  const mine = useQuery(api.learning.getCourse, token && owned ? { token, courseId: id } : "skip");
  const addM = useMutation(api.cart.add);
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [closedSec, setClosedSec] = useState<Set<string>>(new Set()); // lessons are visible by default
  const addBtn = useRef<HTMLButtonElement>(null);

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
      else {
        flyToCart(addBtn.current, c.thumbnail);
        ticket("Added to cart", c.title);
      }
    } catch (e) {
      setErr(errorMessage(e, "Couldn’t add this course. Please try again."));
    }
    setBusy(false);
  };
  const toggle = (sid: string) =>
    setClosedSec((p) => {
      const n = new Set(p);
      if (!n.delete(sid)) n.add(sid);
      return n;
    });
  const allOpen = closedSec.size === 0;

  // Progress and the "next up" lesson (the one they last watched if unfinished, else the first unfinished)
  const doneIds = new Set(mine?.sections.flatMap((s) => s.lessons.filter((l) => l.completed).map((l) => l.id)) ?? []);
  const doneCount = mine?.completedCount ?? 0;
  const allIds = c.sections.flatMap((s) => s.lessons.map((l) => l.id));
  const nextId = !owned ? null : mine?.resumeLessonId && !doneIds.has(mine.resumeLessonId) ? mine.resumeLessonId : allIds.find((x) => !doneIds.has(x)) ?? null;
  const nextNo = nextId ? allIds.indexOf(nextId) + 1 : 1;
  const finished = owned && c.lessonCount > 0 && doneCount >= c.lessonCount;
  const startLabel = finished ? "Review course" : doneCount === 0 ? "Start lesson 1" : `Continue lesson ${nextNo}`;
  const pct = c.lessonCount ? Math.round((doneCount / c.lessonCount) * 100) : 0;

  const facts: [string, string, string][] = [
    ["🎬", `${c.lessonCount} video lesson${c.lessonCount === 1 ? "" : "s"}`, "Watch any time"],
    ["⏱", `${length(c.totalSeconds)} of content`, "Learn at your pace"],
    ["📚", `${c.sections.length} section${c.sections.length === 1 ? "" : "s"}`, "Easy to follow"],
    ["🎯", `${c.level} level`, c.level === "Beginner" ? "No experience needed" : "Know what to expect"],
    ["♾️", "Lifetime access", "Never expires"],
    ["📱", "Watch on any device", "Phone, laptop, TV"],
  ];

  const canBuy = !user || user.role === "student"; // guests are sent to log in; instructors and admins never see buy buttons
  const buy = owned ? (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, font: `800 21px ${DISPLAY}` }}>
        <span aria-hidden style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "50%", background: "oklch(0.5 0.13 150)", color: "#fff", fontSize: 17, flex: "none" }}>✓</span>
        You own this course
      </div>
      <div style={{ margin: "14px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T.body, marginBottom: 6 }}>
          <span>Your progress</span>
          <span>{doneCount} of {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}</span>
        </div>
        <div className="arc-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Link href={`/learn/${c.id}`} className="nl btn-hover" style={{ display: "block", textAlign: "center", background: T.purple, color: "#fff", borderRadius: 99, padding: 16, fontWeight: 800, fontSize: 16 }}>
        ▶ {startLabel}
      </Link>
    </>
  ) : !canBuy ? (
    <>
      <PriceTag price={c.price} guarantee={false} />
      <div style={{ background: T.bg, borderRadius: 16, padding: 14, fontSize: 14, lineHeight: 1.5, color: T.body }}>
        {user?.role === "instructor"
          ? "Instructor accounts are for teaching, so courses can’t be bought here. To learn, sign up with a separate student account."
          : "Admin accounts can’t buy courses."}
      </div>
    </>
  ) : (
    <>
      <PriceTag price={c.price} />
      <button
        ref={addBtn}
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
        style={{ width: "100%", marginTop: 12, border: `2px solid ${T.ink}`, background: "#fff", color: T.ink, borderRadius: 99, padding: 14, fontWeight: 800, fontSize: 16, fontFamily: "inherit", cursor: "pointer" }}
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
      <div className="arc-hero" style={{ background: T.deep, color: "#fff" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "34px 40px 40px" }}>
          <div style={{ maxWidth: 820 }}>
            <div style={{ fontSize: 14, color: "oklch(0.85 0.08 300)" }}>
              <Link href="/courses">Courses</Link> › <Link href={`/courses?category=${encodeURIComponent(c.category)}`}>{c.category}</Link>
            </div>
            <h1 className="arc-title" style={{ font: `800 48px/1.05 ${DISPLAY}`, letterSpacing: "-.03em", margin: "14px 0 12px", overflowWrap: "anywhere" }}>{c.title}</h1>
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
            <h2 style={h2}>What you’ll get</h2>
            <p style={hint}>Everything included with this course</p>
            <div className="arc-facts" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {facts.map(([icon, text, note], i) => (
                // Each fact ticks itself off in turn
                <div key={text} className="tick-in arc-key arc-fact" style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", borderRadius: 18, padding: "14px 16px", fontWeight: 700, fontSize: 15, lineHeight: 1.25, animationDelay: `${200 + i * 110}ms` }}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ flex: 1 }}>
                    {text}
                    <small style={{ display: "block", fontWeight: 400, fontSize: 12, color: T.muted, marginTop: 2 }}>{note}</small>
                  </span>
                  <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden focusable={false} style={{ flex: "none" }}>
                    <circle cx="13" cy="13" r="12" fill={T.yellow} />
                    <path d="M8 13.5l3.5 3.5 6.5-7" stroke={T.ink} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: `${450 + i * 110}ms` }} />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Course content */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 style={h2}>Course content</h2>
              {c.sections.length > 1 && (
                <button
                  onClick={() => setClosedSec(allOpen ? new Set(c.sections.map((s) => s.id)) : new Set())}
                  style={{ background: "none", border: 0, color: T.purple, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              )}
            </div>
            <p style={hint}>
              {c.sections.length} section{c.sections.length === 1 ? "" : "s"} · {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"} · {length(c.totalSeconds)} total ·{" "}
              {owned ? "all lessons unlocked" : "🔒 lessons unlock when you buy the course; the preview is free"}
            </p>
            {owned && nextId && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "oklch(0.95 0.06 300)", border: `2px solid ${T.ink}`, borderRadius: 20, padding: "14px 18px", marginBottom: 16 }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ font: `700 11px ${MONO}`, letterSpacing: ".12em", color: T.purple }}>{doneCount === 0 ? "START HERE" : "CONTINUE LEARNING"}</div>
                  <div style={{ font: `800 19px ${DISPLAY}`, marginTop: 2, overflowWrap: "anywhere" }}>
                    Lesson {nextNo} · {c.sections.flatMap((s) => s.lessons).find((l) => l.id === nextId)?.title}
                  </div>
                </div>
                <Link href={`/learn/${c.id}`} className="nl btn-hover" style={{ background: T.purple, color: "#fff", borderRadius: 99, padding: "10px 22px", fontWeight: 800, fontSize: 14 }}>
                  Start ▶
                </Link>
              </div>
            )}
            {c.sections.map((s) => {
              const open = !closedSec.has(s.id);
              const secs = s.lessons.reduce((n, l) => n + l.duration, 0);
              return (
                <div key={s.id} style={{ marginBottom: 6 }}>
                  <button
                    onClick={() => toggle(s.id)}
                    aria-expanded={open}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 4px 10px", background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", font: `800 17px ${DISPLAY}`, color: T.ink }}
                  >
                    <span aria-hidden style={{ transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>›</span>
                    <span style={{ flex: 1, overflowWrap: "anywhere" }}>{s.title}</span>
                    <span style={{ font: `400 12px ${MONO}`, color: T.muted, whiteSpace: "nowrap" }}>{s.lessons.length} lesson{s.lessons.length === 1 ? "" : "s"} · {length(secs)}</span>
                  </button>
                  {open &&
                    s.lessons.map((l) => {
                      const no = allIds.indexOf(l.id) + 1;
                      const done = doneIds.has(l.id);
                      const next = l.id === nextId;
                      return (
                        <Link
                          key={l.id}
                          href={owned ? `/learn/${c.id}` : "#"}
                          onClick={owned ? undefined : (e) => e.preventDefault()}
                          aria-disabled={!owned}
                          className="nl arc-key arc-lesson"
                          style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px 12px 12px", borderRadius: 16, marginBottom: 12, background: next ? "oklch(0.95 0.06 300)" : "#fff", cursor: owned ? "pointer" : "default" }}
                        >
                          <span style={{ minWidth: 54, height: 34, padding: "0 8px", borderRadius: 10, border: `2px solid ${T.ink}`, background: next ? T.purple : T.yellow, color: next ? "#fff" : T.ink, display: "grid", placeItems: "center", font: `800 13px ${MONO}`, flex: "none" }}>
                            LV {no}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ display: "block", font: `700 16px ${DISPLAY}`, overflowWrap: "anywhere" }}>{l.title}</b>
                            <small style={{ fontSize: 12, color: T.muted }}>Lesson {no}</small>
                          </span>
                          <span style={{ font: `700 13px ${MONO}`, color: T.muted }}>{fmtDuration(l.duration)}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 78, textAlign: "right" }}>
                            {!owned ? (
                              <span style={{ color: T.muted }} title="Unlocks when you buy the course">🔒 Locked</span>
                            ) : done ? (
                              <span style={{ color: "oklch(0.5 0.13 150)" }}>✓ Done</span>
                            ) : next ? (
                              <span className="arc-chip">Next up</span>
                            ) : (
                              <span style={{ color: T.purple }}>▶ Play</span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              );
            })}
          </div>

          {/* About */}
          <div style={card}>
            <h2 style={{ ...h2, marginBottom: 14 }}>About this course</h2>
            <div style={{ lineHeight: 1.75, fontSize: 16, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.description}</div>
          </div>

          {/* Instructor */}
          <div style={card}>
            <h2 style={{ ...h2, marginBottom: 14 }}>Your instructor</h2>
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
        <div className="course-buy arc-card" style={{ background: "#fff", borderRadius: 28, padding: 18 }}>
          <div className="arc-screen">
            {c.hasPromo ? (
              <VideoPlayer kind="promo" id={c.id} style={{ borderRadius: 0 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.thumbnail} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
            )}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 10 }}>
            <b style={{ color: T.ink }}>Free preview</b> · {c.hasPromo ? "watch before you buy" : "preview video coming soon"}
          </div>
          <div style={{ height: 14 }} />
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
