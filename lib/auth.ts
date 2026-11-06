// Client-side helpers for the auth UI: types and form validation hints only.
// All real authentication/authorization (passwords, sessions, roles, approvals) lives in Convex — see /convex.
// Anything checked here is repeated on the server, so bypassing it gains nothing.

export type Role = "student" | "instructor" | "admin";
export type SignupRole = Exclude<Role, "admin">;
export type Status = "approved" | "pending" | "rejected" | "suspended";

export type Session = { id: string; name: string; email: string; role: Role; status: Status; rejectionReason?: string };
export type AuthResult = { ok: true; session: Session } | { ok: false; error: string; field?: "email" | "password" | "name" };

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Returns null when the password is acceptable, otherwise a message. */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Include at least one letter and one number.";
  return null;
}

/** 0–4 strength score for the sign-up meter. */
export function passwordStrength(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return s;
}

/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
export const safeNext = (n: string | null, fallback: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : fallback);
