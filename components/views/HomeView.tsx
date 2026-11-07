"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CATS, fmt } from "@/lib/data";
import { DISPLAY, T, pastel } from "@/lib/theme";
import { useStore } from "../store";
import { useAuth } from "../auth";
import Reveal from "../Reveal";
import { HeroArt, TopicGlyph } from "../Art";
import TrustedBy from "../TrustedBy";
import { RECOMMENDED, REVIEWS, STATS } from "@/lib/home-content";

// Small, fixed tilts so tiles look hand-placed (deterministic, so server and client render the same).
const TILT = [-1.4, 1.1, -0.7, 1.6, 0.9, -1.2, 1.4, -0.9];

const POPULAR = ["Python", "Figma", "Excel", "Spanish", "Guitar", "Yoga", "Prompt engineering"];

export default function HomeView() {
  const { set } = useStore();
  const { user: me, ready } = useAuth();
  const isStudent = !ready || !!me; // teaching promos are for logged-out visitors only; hidden until auth is known
  const live = useQuery(api.catalog.listLive) ?? [];
  const countOf = (name: string) => live.filter((c) => c.category === name).length;
  const router = useRouter();
  const search = (term: string) => {
    set({ q: term });
    router.push("/courses");
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 40px 60px" }}>
      {/* Screen 1: hero + stats fill one full viewport (nav is ~110px tall) */}
      <section style={{ minHeight: "calc(100vh - 110px)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <div style={{ font: `800 76px/1 ${DISPLAY}`, letterSpacing: "-.035em" }}>
              Learn{" "}
              <span className="stk" style={{ background: "oklch(0.88 0.12 90)", padding: "0 12px", borderRadius: 22 }}>
                anything.
              </span>{" "}
              Start in{" "}
              <span className="squiggle">
                minutes
                <svg viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden focusable={false}>
                  <path d="M4 14 C 40 4, 70 20, 100 11 S 160 4, 196 12" />
                </svg>
              </span>
              .
            </div>
            <div style={{ fontSize: 19, lineHeight: 1.5, margin: "20px 0 26px", color: T.muted2, maxWidth: 500 }}>
              Courses in code, design, business, music, languages and more. Learn at your pace.
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <Link href="/courses" className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "14px 28px", borderRadius: 99, cursor: "pointer" }}>
                Browse all courses <span className="arr">→</span>
              </Link>
              {!isStudent && (
                <Link href="/instructor" className="nl btn-hover" style={{ background: "#fff", fontWeight: 700, padding: "14px 28px", borderRadius: 99, cursor: "pointer" }}>
                  Become an instructor
                </Link>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 22, fontSize: 14 }}>
              <span style={{ color: T.muted2, fontWeight: 600 }}>Popular:</span>
              {POPULAR.map((p, i) => (
                <span
                  key={p}
                  className="chip-hover"
                  onClick={() => search(p)}
                  style={{ background: "#fff", borderRadius: 99, padding: "6px 14px", fontWeight: 600, cursor: "pointer", ["--r" as string]: `${TILT[i % TILT.length] * 3}deg` }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "170px 170px", gap: 16 }}>
            <div className="float-tile" style={{ gridRow: "span 2", borderRadius: 32, overflow: "hidden", ["--r" as string]: "-2deg" }}>
              <HeroArt kind="learner" />
            </div>
            <div className="float-tile" style={{ borderRadius: 32, overflow: "hidden", ["--r" as string]: "2.5deg" }}>
              <HeroArt kind="idea" />
            </div>
            <div className="float-tile" style={{ borderRadius: 32, overflow: "hidden", ["--r" as string]: "-1.5deg" }}>
              <HeroArt kind="books" />
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 40, justifyContent: "center", fontSize: 15, color: T.muted2, flexWrap: "wrap", marginTop: 44 }}>
          {STATS.map(([b, t]) => (
            <span key={b}>
              <b style={{ color: T.ink }}>{b}</b> {t}
            </span>
          ))}
        </div>

        {/* Trending topics */}
        <div style={{ marginTop: 34 }}>
          <div style={{ font: `800 20px ${DISPLAY}`, marginBottom: 12 }}>🔥 Trending topics</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
            {RECOMMENDED.slice(0, 4).map((r, i) => (
              <div key={r.t} onClick={() => search(r.q)} className="card-hover" style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", borderRadius: 22, padding: 10, cursor: "pointer", ["--r" as string]: `${TILT[i]}deg` }}>
                <div style={{ width: 58, height: 58, borderRadius: 14, background: pastel(r.hue, 0.88, 0.09), flex: "none", display: "grid", placeItems: "center" }}>
                  <TopicGlyph kind={r.art} hue={r.hue} size={32} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>{r.t}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{r.tag} right now</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screen 2: categories start on their own page, with a quote panel beside them */}
      <section style={{ paddingTop: 60 }}>
        <Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 36, alignItems: "stretch" }}>
            <div style={{ background: T.deep, color: "#fff", borderRadius: 32, padding: 30 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(0.85 0.14 70)" }}>Explore by category</div>
              <div style={{ font: `800 34px/1.1 ${DISPLAY}`, letterSpacing: "-.02em", margin: "12px 0 14px" }}>
                Learn essential career and life skills
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: "oklch(0.88 0.05 300)" }}>
                QuickAI helps you build in-demand skills fast — from your first lesson to job-ready, at your own pace.
              </div>
              <div style={{ display: "flex", gap: 22, margin: "20px 0 24px" }}>
                <div>
                  <div style={{ font: `800 26px ${DISPLAY}`, color: T.orange }}>{CATS.length}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>categories</div>
                </div>
              </div>
              <Link href="/courses" className="nl btn-hover" style={{ display: "inline-block", background: T.orange, color: T.ink, fontWeight: 700, padding: "12px 22px", borderRadius: 99 }}>
                Browse all courses <span className="arr">→</span>
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gridTemplateRows: "repeat(3,1fr)", gap: 16 }}>
              {CATS.slice(0, 12).map((g, i) => (
                <Link
                  key={g.name}
                  href={`/courses?category=${encodeURIComponent(g.name)}`}
                  className="nl tile-hover"
                  onClick={() => set({ q: "" })}
                  style={{ cursor: "pointer", background: pastel(g.hue), borderRadius: 24, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8, ["--r" as string]: `${TILT[i % TILT.length]}deg` }}
                >
                  <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.15 }}>{g.name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span className="tile-arrow" style={{ fontWeight: 800, fontSize: 18 }}>→</span>
                    {/* Course count as a rubber stamp */}
                    <span className="stamp">
                      {fmt(countOf(g.name))}
                      <br />
                      {countOf(g.name) === 1 ? "course" : "courses"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <TrustedBy />

      {/* Most recommended */}
      <section style={{ paddingTop: 56 }}>
        <div style={{ font: `800 36px ${DISPLAY}`, letterSpacing: "-.02em" }}>Most recommended for you</div>
        <div style={{ color: T.muted2, fontSize: 17, margin: "8px 0 24px" }}>AI and the other topics learners are choosing right now.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "34px 22px", paddingTop: 12 }}>
          {RECOMMENDED.map((r, i) => (
            <div key={r.t} onClick={() => search(r.q)} className="card-hover taped" style={{ background: "#fff", borderRadius: 28, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", ["--r" as string]: `${TILT[(i + 3) % TILT.length]}deg` }}>
              <div style={{ height: 120, borderRadius: 20, background: pastel(r.hue, 0.88, 0.09), position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-start", padding: 12 }}>
                <span aria-hidden style={{ position: "absolute", right: -22, bottom: -34, width: 110, height: 110, borderRadius: "50%", background: pastel(r.hue, 0.93, 0.07) }} />
                <span aria-hidden style={{ position: "absolute", left: "38%", top: -26, width: 56, height: 56, borderRadius: "50%", background: pastel(r.hue, 0.92, 0.06) }} />
                <span aria-hidden style={{ position: "absolute", right: 26, bottom: 14 }}>
                  <TopicGlyph kind={r.art} hue={r.hue} size={72} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, background: r.tag === "Hot" ? T.purple : T.yellow, color: r.tag === "Hot" ? "#fff" : T.ink, padding: "4px 10px", borderRadius: 99 }}>{r.tag}</span>
              </div>
              <div style={{ font: `800 18px/1.25 ${DISPLAY}`, margin: "14px 4px 4px" }}>{r.t}</div>
              <div style={{ fontSize: 13, color: T.muted, margin: "0 4px 12px", lineHeight: 1.45 }}>{r.sub}</div>
              <div style={{ margin: "auto 4px 4px", fontWeight: 800, fontSize: 14, color: T.purple }}>Explore courses →</div>
            </div>
          ))}
        </div>
      </section>

      {/* Promos */}
      <div style={{ display: "grid", gridTemplateColumns: isStudent ? "1fr 1fr" : "1fr 1fr 1fr", gap: 20, marginTop: 56 }}>
        <div className="tile-hover" style={{ background: "oklch(0.9 0.08 300)", borderRadius: 30, padding: 30, ["--r" as string]: "-1deg" }}>
          <div style={{ font: `800 26px/1.1 ${DISPLAY}` }}>Skill paths</div>
          <div style={{ margin: "10px 0 16px", color: "#4b4466" }}>Curated sequences that take you from first lesson to job-ready.</div>
          <b>Explore paths →</b>
        </div>
        <div className="tile-hover" style={{ background: "oklch(0.9 0.08 150)", borderRadius: 30, padding: 30, ["--r" as string]: "0.8deg" }}>
          <div style={{ font: `800 26px/1.1 ${DISPLAY}` }}>QuickAI for Business</div>
          <div style={{ margin: "10px 0 16px", color: "#3f5a47" }}>Upskill your whole team with analytics, assignments and SSO.</div>
          <b>Request a demo →</b>
        </div>
        {!isStudent && (
          <div className="tile-hover" style={{ background: "oklch(0.9 0.1 90)", borderRadius: 30, padding: 30, ["--r" as string]: "-0.6deg" }}>
            <div style={{ font: `800 26px/1.1 ${DISPLAY}` }}>Teach what you know</div>
            <div style={{ margin: "10px 0 16px", color: "#5f5320" }}>Reach millions of learners and keep up to 70% of every sale.</div>
            <Link href="/instructor" className="nl" style={{ fontWeight: "bold", cursor: "pointer" }}>
              Start teaching →
            </Link>
          </div>
        )}
      </div>

      {/* Testimonials */}
      <div style={{ font: `800 32px ${DISPLAY}`, margin: "56px 0 18px", letterSpacing: "-.02em" }}>Learners love it</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 20 }}>
        {REVIEWS.map((r, i) => (
          <div key={r.n} className="card-hover taped" style={{ background: "#fff", borderRadius: 28, padding: 24, ["--r" as string]: `${TILT[(i + 1) % TILT.length]}deg` }}>
            <div style={{ color: T.star }}>★★★★★</div>
            <div style={{ fontSize: 16, lineHeight: 1.5, margin: "10px 0 16px" }}>“{r.x}”</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {r.n} <span style={{ fontWeight: 400, color: T.muted }}>· {r.c}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
