"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { DISPLAY, MONO, T } from "@/lib/theme";

export type Variant = "student" | "instructor" | "signup" | "apply" | "admin";

const PANELS: Record<Variant, { bg: string; accent: string; eyebrow: string; headline: string; points: string[] }> = {
  student: {
    bg: T.deep,
    accent: T.orange,
    eyebrow: "Student login",
    headline: "Pick up right where you left off.",
    points: ["Resume every course at the exact lesson you stopped", "Track progress and earn certificates", "Wishlist, cart and receipts in one place"],
  },
  instructor: {
    bg: "#1c1530",
    accent: T.yellow,
    eyebrow: "Instructor login",
    headline: "Teach what you know. Get paid for it.",
    points: ["Publish courses to millions of learners", "Keep up to 70% of every sale", "Track revenue, students and reviews live"],
  },
  apply: {
    bg: "#1c1530",
    accent: T.yellow,
    eyebrow: "Apply to teach",
    headline: "Share your skills with millions of learners.",
    points: ["Every instructor is reviewed by our team", "Courses go live only after approval", "Keep up to 70% of every sale"],
  },
  admin: {
    bg: "#14101f",
    accent: T.orange,
    eyebrow: "Admin console",
    headline: "Keep QuickAI safe and high quality.",
    points: ["Review instructor applications", "Approve or take down courses", "Every action is logged"],
  },
  signup: {
    bg: T.deep,
    accent: T.orange,
    eyebrow: "Join QuickAI",
    headline: "Learn anything. Start in minutes.",
    points: ["14,000+ courses with lifetime access", "30-day money-back guarantee", "Learn at your pace, on any device"],
  },
};

export function AuthLayout({ variant, title, subtitle, children, footer }: { variant: Variant; title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const p = PANELS[variant];
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 40px 60px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1fr)", background: "#fff", borderRadius: 36, overflow: "hidden", boxShadow: "0 20px 50px oklch(0.3 0.1 300 / .12)", minHeight: 620 }}>
        {/* Brand panel */}
        <div style={{ background: p.bg, color: "#fff", padding: 40, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "oklch(0.55 0.2 300 / .35)", right: -90, bottom: -80 }} />
          <div style={{ position: "absolute", width: 120, height: 120, borderRadius: 36, background: `${p.accent}`, opacity: 0.18, right: 50, bottom: 150, transform: "rotate(14deg)" }} />
          <Link href="/" className="nl" style={{ font: `800 28px ${DISPLAY}`, color: "#fff" }}>
            quickai<span style={{ color: T.orange }}>•</span>
          </Link>
          <div style={{ marginTop: "auto", position: "relative" }}>
            <div style={{ font: `700 12px ${MONO}`, letterSpacing: ".1em", textTransform: "uppercase", color: p.accent }}>{p.eyebrow}</div>
            <div style={{ font: `800 38px/1.08 ${DISPLAY}`, letterSpacing: "-.025em", margin: "12px 0 22px" }}>{p.headline}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {p.points.map((t) => (
                <div key={t} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.4, color: "oklch(0.9 0.04 300)" }}>
                  <span style={{ color: p.accent, fontWeight: 800 }}>✓</span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form side */}
        <div style={{ padding: "44px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ font: `800 34px ${DISPLAY}`, letterSpacing: "-.02em" }}>{title}</div>
          <div style={{ color: T.muted2, margin: "6px 0 22px", fontSize: 15 }}>{subtitle}</div>
          {children}
          {footer && <div style={{ marginTop: 22, fontSize: 14, color: T.muted2, textAlign: "center" }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/** Switches between the two separate logins (students vs instructors). */
export function LoginTabs({ active }: { active: "student" | "instructor" }) {
  const tab = (on: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: "center",
    padding: "11px 0",
    borderRadius: 99,
    fontWeight: 700,
    fontSize: 14,
    background: on ? T.ink : "transparent",
    color: on ? "#fff" : T.ink,
    transition: "background .2s ease, color .2s ease",
  });
  return (
    <div style={{ display: "flex", background: T.line, borderRadius: 99, padding: 4, marginBottom: 22 }}>
      <Link href="/login" className="nl" style={tab(active === "student")}>
        🎓 I’m a student
      </Link>
      <Link href="/instructor/login" className="nl" style={tab(active === "instructor")}>
        🧑‍🏫 I’m an instructor
      </Link>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
};

export function Field({ label, value, onChange, error, type = "text", placeholder, autoComplete, hint, right }: FieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label htmlFor={id} style={{ fontWeight: 700, fontSize: 14 }}>
          {label}
        </label>
        {right}
      </div>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          className="field"
          type={isPw && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? id + "-err" : undefined}
          style={{ width: "100%", padding: isPw ? "14px 64px 14px 18px" : "14px 18px", borderRadius: 14, border: `1.5px solid ${error ? T.danger : "oklch(0.88 0.03 300)"}`, fontSize: 15, background: "#fff", color: T.ink, outline: 0 }}
        />
        {isPw && (
          <span
            onClick={() => setShow(!show)}
            role="button"
            aria-label={show ? "Hide password" : "Show password"}
            style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: T.purple, cursor: "pointer", userSelect: "none" }}
          >
            {show ? "Hide" : "Show"}
          </span>
        )}
      </div>
      {hint}
      {error && (
        <div id={id + "-err"} role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, cursor: "pointer", lineHeight: 1.4 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: "oklch(0.55 0.2 300)" }} />
        <span>{children}</span>
      </label>
      {error && (
        <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" style={{ background: "oklch(0.95 0.04 20)", color: "oklch(0.4 0.15 20)", borderRadius: 14, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function SubmitButton({ loading, children, color = T.purple }: { loading: boolean; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-hover"
      style={{ width: "100%", background: color, color: color === T.purple ? "#fff" : T.ink, border: 0, borderRadius: 99, padding: 16, fontWeight: 800, fontSize: 16, fontFamily: "inherit", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1 }}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function Textarea({ label, value, onChange, error, placeholder, hint, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; hint?: React.ReactNode; rows?: number }) {
  const id = useId();
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ fontWeight: 700, fontSize: 14, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <textarea
        id={id}
        className="field"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        style={{ width: "100%", padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${error ? T.danger : "oklch(0.88 0.03 300)"}`, fontSize: 15, background: "#fff", color: T.ink, outline: 0, resize: "vertical", fontFamily: "inherit" }}
      />
      {hint}
      {error && (
        <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
