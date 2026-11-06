"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CATS, fmt } from "@/lib/data";
import { DISPLAY, MONO, T, pastel } from "@/lib/theme";
import { useStore } from "../store";
import Reveal from "../Reveal";

const POPULAR = ["Python", "Figma", "Excel", "Spanish", "Guitar", "Yoga", "Prompt engineering"];

export default function HomeView() {
  const { set } = useStore();
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
              <span style={{ background: "oklch(0.88 0.12 90)", padding: "0 12px", borderRadius: 22, display: "inline-block", transform: "rotate(-2deg)" }}>
                anything.
              </span>{" "}
              Start in minutes.
            </div>
            <div style={{ fontSize: 19, lineHeight: 1.5, margin: "20px 0 26px", color: T.muted2, maxWidth: 500 }}>
              Courses in code, design, business, music, languages and more. Learn at your pace.
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/courses" className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "16px 30px", borderRadius: 99, cursor: "pointer" }}>
                Browse all courses
              </Link>
              <Link href="/instructor" className="nl btn-hover" style={{ background: "#fff", fontWeight: 700, padding: "16px 30px", borderRadius: 99, cursor: "pointer" }}>
                Become an instructor
              </Link>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 22, fontSize: 14 }}>
              <span style={{ color: T.muted2, fontWeight: 600 }}>Popular:</span>
              {POPULAR.map((p) => (
                <span
                  key={p}
                  className="chip-hover"
                  onClick={() => search(p)}
                  style={{ background: "#fff", borderRadius: 99, padding: "6px 14px", fontWeight: 600, cursor: "pointer" }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "170px 170px", gap: 14 }}>
            <div className="float-tile" style={{ gridRow: "span 2", borderRadius: 32, background: "oklch(0.88 0.09 300)", display: "flex", alignItems: "flex-end", padding: 16, font: `12px ${MONO}`, color: "oklch(0.4 0.1 300)" }}>
              [ hero photo — learner ]
            </div>
            <div className="float-tile" style={{ borderRadius: 32, background: "oklch(0.9 0.1 90)", display: "flex", alignItems: "flex-end", padding: 16, font: `12px ${MONO}`, color: "oklch(0.4 0.1 90)" }}>
              [ photo ]
            </div>
            <div className="float-tile" style={{ borderRadius: 32, background: "oklch(0.9 0.08 150)", display: "flex", alignItems: "flex-end", padding: 16, font: `12px ${MONO}`, color: "oklch(0.4 0.1 150)" }}>
              [ photo ]
            </div>
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
              <Link href="/courses" className="nl btn-hover" style={{ display: "inline-block", background: T.orange, color: T.ink, fontWeight: 700, padding: "13px 24px", borderRadius: 99 }}>
                Browse all courses →
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gridTemplateRows: "repeat(3,1fr)", gap: 14 }}>
              {CATS.slice(0, 12).map((g) => (
                <Link
                  key={g.name}
                  href={`/courses?category=${encodeURIComponent(g.name)}`}
                  className="nl tile-hover"
                  onClick={() => set({ q: "" })}
                  style={{ cursor: "pointer", background: pastel(g.hue), borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                >
                  <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.15 }}>{g.name}</div>
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>{fmt(countOf(g.name))} {countOf(g.name) === 1 ? "course" : "courses"}</span>
                    <span className="tile-arrow" style={{ fontWeight: 800 }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Promos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 56 }}>
        <div style={{ background: "oklch(0.9 0.08 300)", borderRadius: 30, padding: 30 }}>
          <div style={{ font: `800 26px/1.1 ${DISPLAY}` }}>Skill paths</div>
          <div style={{ margin: "10px 0 16px", color: "#4b4466" }}>Curated sequences that take you from first lesson to job-ready.</div>
          <b>Explore paths →</b>
        </div>
        <div style={{ background: "oklch(0.9 0.08 150)", borderRadius: 30, padding: 30 }}>
          <div style={{ font: `800 26px/1.1 ${DISPLAY}` }}>QuickAI for Business</div>
          <div style={{ margin: "10px 0 16px", color: "#3f5a47" }}>Upskill your whole team with analytics, assignments and SSO.</div>
          <b>Request a demo →</b>
        </div>
        <div style={{ background: "oklch(0.9 0.1 90)", borderRadius: 30, padding: 30 }}>
          <div style={{ font: `800 26px/1.1 ${DISPLAY}` }}>Teach what you know</div>
          <div style={{ margin: "10px 0 16px", color: "#5f5320" }}>Reach millions of learners and keep up to 70% of every sale.</div>
          <Link href="/instructor" className="nl" style={{ fontWeight: "bold", cursor: "pointer" }}>
            Start teaching →
          </Link>
        </div>
      </div>

    </div>
  );
}
