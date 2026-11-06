"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isEmail } from "@/lib/auth";
import { T } from "@/lib/theme";
import { AuthLayout, Field, SubmitButton } from "../auth-ui";

// UI only: hook `submit` up to your backend's "send reset link" endpoint.
export default function ForgotForm() {
  const isTeacher = useSearchParams().get("role") === "instructor";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setError("Enter a valid email address.");
    setError("");
    setSent(true);
  };

  return (
    <AuthLayout
      variant={isTeacher ? "instructor" : "student"}
      title="Reset your password"
      subtitle="Enter the email you signed up with and we’ll send you a reset link."
      footer={
        <Link href={isTeacher ? "/instructor/login" : "/login"} style={{ fontWeight: 700 }}>
          ← Back to log in
        </Link>
      }
    >
      {sent ? (
        <div style={{ background: "oklch(0.9 0.08 150)", borderRadius: 20, padding: 22, color: "#3f5a47", lineHeight: 1.5 }}>
          <b>Check your inbox ✓</b>
          <div style={{ marginTop: 6, fontSize: 14 }}>If an account exists for {email}, a reset link is on its way.</div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field label="Email" type="email" value={email} onChange={setEmail} error={error} placeholder="you@email.com" autoComplete="email" />
          <SubmitButton loading={false} color={isTeacher ? T.orange : T.purple}>
            Send reset link
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
