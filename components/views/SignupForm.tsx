"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isEmail, passwordProblem, passwordStrength, safeNext, type SignupRole } from "@/lib/auth";
import { T } from "@/lib/theme";
import { useAuth } from "../auth";
import { AuthLayout, Checkbox, Field, FormError, SubmitButton, Textarea } from "../auth-ui";

const STRENGTH = ["Too weak", "Weak", "Okay", "Good", "Strong"];
const STRENGTH_COLOR = ["oklch(0.7 0.15 25)", "oklch(0.7 0.15 25)", "oklch(0.8 0.15 80)", "oklch(0.75 0.15 140)", "oklch(0.65 0.17 150)"];

export default function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { signUp } = useAuth();

  const [role, setRole] = useState<SignupRole>(params.get("role") === "instructor" ? "instructor" : "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [headline, setHeadline] = useState("");
  const [teaches, setTeaches] = useState("");
  const [bio, setBio] = useState("");
  const [link, setLink] = useState("");
  const [agree, setAgree] = useState(false);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = password ? passwordStrength(password) : -1;
  const isTeacher = role === "instructor";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Enter your full name.";
    if (!email.trim()) errs.email = "Enter your email address.";
    else if (!isEmail(email)) errs.email = "That doesn’t look like a valid email.";
    const pw = passwordProblem(password);
    if (pw) errs.password = pw;
    if (confirm !== password) errs.confirm = "Passwords don’t match.";
    if (isTeacher) {
      if (headline.trim().length < 5) errs.headline = "Add a short professional headline.";
      if (teaches.trim().length < 2) errs.teaches = "Tell us what you’d like to teach.";
      if (bio.trim().length < 50) errs.bio = `Tell us about your experience (at least 50 characters — ${bio.trim().length} so far).`;
      if (link.trim() && !/^https?:\/\/\S+\.\S+/.test(link.trim())) errs.link = "Enter a full link starting with http:// or https://";
      if (!rights) errs.rights = "You must confirm you own the rights to the content you’ll upload.";
    }
    if (!agree) errs.agree = "Please accept the Terms and Privacy Policy to continue.";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;

    setLoading(true);
    const r = await signUp({
      name,
      email,
      password,
      role,
      remember: true,
      application: isTeacher ? { headline: headline.trim(), teaches: teaches.trim(), bio: bio.trim(), link: link.trim() || undefined } : undefined,
    });
    setLoading(false);
    if (!r.ok) {
      if (r.field) setErrors({ [r.field]: r.error });
      else setFormError(r.error);
      return;
    }
    // New instructors land on the "under review" screen until an admin approves them.
    router.replace(safeNext(next, isTeacher ? "/instructor" : "/"));
  };

  const roleCard = (r: SignupRole, icon: string, title: string, sub: string) => {
    const on = role === r;
    return (
      <div
        key={r}
        onClick={() => setRole(r)}
        role="radio"
        aria-checked={on}
        style={{ flex: 1, cursor: "pointer", borderRadius: 18, padding: "14px 16px", border: `2px solid ${on ? T.purple : "oklch(0.9 0.02 300)"}`, background: on ? "oklch(0.96 0.03 300)" : "#fff", transition: "all .2s ease" }}
      >
        <div style={{ fontSize: 22 }}>{icon}</div>
        <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.muted }}>{sub}</div>
      </div>
    );
  };

  return (
    <AuthLayout
      variant={isTeacher ? "apply" : "signup"}
      title={isTeacher ? "Apply to teach" : "Create your account"}
      subtitle={isTeacher ? "Tell us about yourself. Our team reviews every application before you can publish." : "Join QuickAI — it takes less than a minute."}
      footer={
        <>
          Already have an account?{" "}
          <Link href={isTeacher ? "/instructor/login" : "/login"} style={{ fontWeight: 700 }}>
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div role="radiogroup" aria-label="Account type" style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          {roleCard("student", "🎓", "Student", "Learn new skills")}
          {roleCard("instructor", "🧑‍🏫", "Instructor", "Apply to teach & earn")}
        </div>
        <FormError>{formError}</FormError>
        <Field label="Full name" value={name} onChange={setName} error={errors.name} placeholder="Your name" autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="you@email.com" autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          placeholder="At least 8 characters, with a number"
          autoComplete="new-password"
          hint={
            strength >= 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ flex: 1, height: 5, borderRadius: 9, background: i <= strength - 1 ? STRENGTH_COLOR[strength] : T.line, transition: "background .2s ease" }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{STRENGTH[strength]}</div>
              </div>
            )
          }
        />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} placeholder="Re-enter your password" autoComplete="new-password" />

        {isTeacher && (
          <div style={{ background: "oklch(0.97 0.02 90)", borderRadius: 20, padding: "18px 18px 2px", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Your teaching application</div>
            <div style={{ fontSize: 13, color: T.muted2, marginBottom: 14, lineHeight: 1.5 }}>
              Your headline, what you teach, your experience and your link are shown to students on your course pages, so write them for students. Your email is never shown.
            </div>
            <Field label="Professional headline (shown to students)" value={headline} onChange={setHeadline} error={errors.headline} placeholder="e.g. Senior data analyst with 10 years’ experience" />
            <Field label="What would you like to teach?" value={teaches} onChange={setTeaches} error={errors.teaches} placeholder="e.g. Python, watercolor, Spanish" />
            <Textarea label="Your experience & qualifications (shown to students)" value={bio} onChange={setBio} error={errors.bio} placeholder="Your background, qualifications, projects and past teaching. Students read this before they buy." />
            <Field label="LinkedIn or portfolio link (optional, shown to students)" value={link} onChange={setLink} error={errors.link} placeholder="https://" />
            <Checkbox checked={rights} onChange={setRights} error={errors.rights}>
              I own the rights to everything I’ll upload and I’ll follow QuickAI’s <b>Content Guidelines</b> (no explicit, hateful or illegal content).
            </Checkbox>
          </div>
        )}

        <Checkbox checked={agree} onChange={setAgree} error={errors.agree}>
          I agree to the QuickAI <b>Terms of Use</b> and <b>Privacy Policy</b>.
        </Checkbox>
        <SubmitButton loading={loading} color={isTeacher ? T.orange : T.purple}>
          {isTeacher ? "Submit application" : "Create account"}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
