"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isEmail, safeNext, type Role } from "@/lib/auth";
import { T } from "@/lib/theme";
import { useAuth } from "../auth";
import { AuthLayout, Checkbox, Field, FormError, LoginTabs, SubmitButton } from "../auth-ui";

const COPY = {
  student: { title: "Welcome back", subtitle: "Log in to continue learning.", cta: "Log in", home: "/my-courses", placeholder: "you@email.com" },
  instructor: { title: "Instructor log in", subtitle: "Sign in to your studio to manage courses, students and earnings.", cta: "Log in to studio", home: "/instructor", placeholder: "you@school.com" },
  admin: { title: "Admin log in", subtitle: "Authorised QuickAI staff only.", cta: "Log in to console", home: "/admin", placeholder: "Email or username" },
} as const;

export default function LoginForm({ role }: { role: Role }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { logIn } = useAuth();
  const c = COPY[role];
  const isTeacher = role === "instructor";
  const isAdmin = role === "admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = "Enter your email address.";
    else if (!isAdmin && !isEmail(email)) errs.email = "That doesn’t look like a valid email.";
    if (!password) errs.password = "Enter your password.";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;

    setLoading(true);
    const r = await logIn({ email, password, role, remember });
    setLoading(false);
    if (!r.ok) return setFormError(r.error);
    router.replace(safeNext(next, c.home));
  };

  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const nextQ = next ? `&next=${encodeURIComponent(next)}` : "";

  return (
    <AuthLayout
      variant={role}
      title={c.title}
      subtitle={c.subtitle}
      footer={
        isAdmin ? undefined : (
          <>
            {isTeacher ? "Want to teach on QuickAI? " : "Don’t have an account? "}
            <Link href={`/signup?role=${role}${nextQ}`} style={{ fontWeight: 700 }}>
              {isTeacher ? "Apply to become an instructor" : "Sign up"}
            </Link>
          </>
        )
      }
    >
      {!isAdmin && <LoginTabs active={role as "student" | "instructor"} />}
      <form onSubmit={submit} noValidate>
        <FormError>{formError}</FormError>
        <Field label={isAdmin ? "Email or username" : "Email"} type={isAdmin ? "text" : "email"} value={email} onChange={setEmail} error={errors.email} placeholder={c.placeholder} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          placeholder="Your password"
          autoComplete="current-password"
          right={
            !isAdmin && (
              <Link href={`/forgot?role=${role}`} style={{ fontSize: 13, fontWeight: 700 }}>
                Forgot password?
              </Link>
            )
          }
        />
        <Checkbox checked={remember} onChange={setRemember}>
          Keep me logged in on this device
        </Checkbox>
        <SubmitButton loading={loading} color={role === "student" ? T.purple : T.orange}>
          {c.cta}
        </SubmitButton>
      </form>
      {!isAdmin && (
        <div style={{ marginTop: 14, fontSize: 13, color: T.muted, textAlign: "center" }}>
          {isTeacher ? "Are you a learner? " : "Teaching on QuickAI? "}
          <Link href={isTeacher ? `/login${q}` : "/instructor/login"} style={{ fontWeight: 700 }}>
            {isTeacher ? "Student login" : "Instructor login"}
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
