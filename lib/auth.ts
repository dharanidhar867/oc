// Client-side helpers for the auth UI: types and form validation hints only.
// All real authentication/authorization (passwords, sessions, roles, approvals) lives in Convex — see /convex.
// Anything checked here is repeated on the server, so bypassing it gains nothing.

export type Role = "student" | "instructor" | "admin";
export type SignupRole = Exclude<Role, "admin">;
export type Status = "approved" | "pending" | "rejected" | "suspended";

export type Session = { id: string; name: string; email: string; role: Role; status: Status; rejectionReason?: string };
export type AuthFail = { ok: false; error: string; field?: "email" | "password" | "name"; captcha?: true };
export type AuthResult = { ok: true; session: Session } | AuthFail;

export const isEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Returns null when the password is acceptable, otherwise a message. */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters.";
  if (p.length > 200) return "Password is too long.";
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

/**
 * Only allow same-site redirects (prevents open-redirect via ?next=). Resolved with the real URL parser rather than
 * a prefix check: browsers strip tabs/newlines and treat "\" as "/", so "/\t/evil.com" or "/\evil.com" mean "//evil.com".
 * Returns the normalised path, so nothing later re-interprets the raw string.
 */
export function safeNext(n: string | null, fallback: string): string {
  if (!n || !n.startsWith("/")) return fallback;
  const base = "https://same-origin.invalid";
  try {
    const u = new URL(n, base);
    return u.origin === base ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}
