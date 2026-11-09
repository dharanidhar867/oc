// Shared server-side helpers: password hashing, session tokens, and authorization guards.
// Not a public API — nothing here is exported as a Convex function.
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Role = Doc<"users">["role"];

export const SESSION_MS_REMEMBER = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MS_SHORT = 24 * 60 * 60 * 1000;
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;

export const normEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const normUsername = (u: string) => u.trim().toLowerCase();

export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters.";
  if (p.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Include at least one letter and one number.";
  return null;
}

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const fromHex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

/**
 * PBKDF2-HMAC-SHA256 work factor (OWASP's current figure for this algorithm). Argon2id/scrypt would be better,
 * but the Convex runtime only has Web Crypto, where PBKDF2 is the one password KDF.
 * Raising this later is safe: each hash stores the count it was made with, and logins upgrade old hashes.
 */
export const PBKDF2_ITERATIONS = 600_000;
/** Hashes stored before the iteration count was recorded. */
const LEGACY_ITERATIONS = 100_000;
export const iterationsOf = (u: { iterations?: number }) => u.iterations ?? LEGACY_ITERATIONS;

export async function hashPassword(password: string, saltHex?: string, iterations = PBKDF2_ITERATIONS) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return { salt: toHex(salt), hash: toHex(bits), iterations };
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

export const newToken = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

/** Students may be signed in on this many devices at once. Logging in on another one signs out the oldest (limits account sharing). */
export const MAX_STUDENT_SESSIONS = 3;
const MAX_OTHER_SESSIONS = 10;

export async function createSession(ctx: MutationCtx, userId: Doc<"users">["_id"], remember: boolean) {
  const token = newToken();
  const now = Date.now();
  await ctx.db.insert("sessions", {
    userId,
    tokenHash: await sha256Hex(token),
    createdAt: now,
    expiresAt: now + (remember ? SESSION_MS_REMEMBER : SESSION_MS_SHORT),
  });
  // Drop expired sessions and, beyond the device limit, the oldest ones.
  const user = await ctx.db.get(userId);
  const cap = user?.role === "student" ? MAX_STUDENT_SESSIONS : MAX_OTHER_SESSIONS;
  const all = await ctx.db.query("sessions").withIndex("by_userId", (q) => q.eq("userId", userId)).take(200);
  const live = all.filter((s) => s.expiresAt >= now).sort((a, b) => b.createdAt - a.createdAt);
  for (const s of all) if (s.expiresAt < now) await ctx.db.delete(s._id);
  for (const s of live.slice(cap)) await ctx.db.delete(s._id);
  return token;
}

/** How many times `key` has been hit in the current window (read-only). */
export async function rateCount(ctx: QueryCtx, key: string, windowMs: number) {
  const row = await ctx.db.query("rateBuckets").withIndex("by_key", (q) => q.eq("key", key)).unique();
  return row && Date.now() - row.windowStart < windowMs ? row.count : 0;
}

/**
 * Fixed-window rate limiter. Returns false (and records nothing) when `key` has already been used `limit` times
 * in the current window. Callers should RETURN an error rather than throw, so a successful hit is committed.
 */
export async function rateLimit(ctx: MutationCtx, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const row = await ctx.db.query("rateBuckets").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (!row) {
    await ctx.db.insert("rateBuckets", { key, windowStart: now, count: 1 });
    return true;
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return true;
  }
  if (row.count >= limit) return false;
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return true;
}

/** Resolves a session token to its user, or null if missing/expired/unknown. */
export async function getViewer(ctx: QueryCtx, token: string | undefined | null): Promise<Doc<"users"> | null> {
  if (!token || token.length > 128) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
  if (!session || session.expiresAt < Date.now()) return null;
  return await ctx.db.get(session.userId);
}

/** Throws unless the caller is signed in with one of `roles` and an `approved` account. */
export async function requireRole(ctx: QueryCtx, token: string | undefined | null, ...roles: Role[]) {
  const user = await getViewer(ctx, token);
  if (!user) throw new ConvexError("Please log in.");
  if (user.status === "suspended") throw new ConvexError("This account has been suspended.");
  if (!roles.includes(user.role)) throw new ConvexError("You don't have permission to do that.");
  if (user.role === "instructor" && user.status !== "approved") throw new ConvexError("Your instructor account isn't approved yet.");
  return user;
}

// ---------- Admin passcode gate ----------
// Admin power needs BOTH a signed-in admin account AND a passcode entered on this session (adminUnlocks row).
export const ADMIN_UNLOCK_MS = 12 * 60 * 60 * 1000;
export const ADMIN_MAX_FAILURES = 5;
export const ADMIN_LOCK_MS = 30 * 60 * 1000;

export async function sessionOf(ctx: QueryCtx, token: string | undefined | null) {
  if (!token || token.length > 128) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
  return session && session.expiresAt >= Date.now() ? session : null;
}

/** The live unlock for this token's session, or null. */
export async function getAdminUnlock(ctx: QueryCtx, token: string | undefined | null) {
  const session = await sessionOf(ctx, token);
  if (!session) return null;
  const u = await ctx.db.query("adminUnlocks").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).unique();
  return u && u.expiresAt > Date.now() ? u : null;
}

/** True only for an approved admin whose session has a live passcode unlock. Never throws. */
export async function adminUnlocked(ctx: QueryCtx, token: string | undefined | null) {
  const user = await getViewer(ctx, token);
  if (!user || user.role !== "admin" || user.status !== "approved") return false;
  return (await getAdminUnlock(ctx, token)) !== null;
}

/** Guard for every admin function: signed-in admin account AND passcode unlock on this session. */
export async function requireAdmin(ctx: QueryCtx, token: string | undefined | null) {
  const user = await requireRole(ctx, token, "admin");
  if (user.status !== "approved") throw new ConvexError("You don't have permission to do that.");
  if (!(await getAdminUnlock(ctx, token))) throw new ConvexError("Admin passcode required.");
  return user;
}

/** Passcode is stored only as a hash in the ADMIN_PASSCODE_HASH env var: "pbkdf2$<iterations>$<saltHex>$<hashHex>". */
export async function checkPasscode(passcode: string) {
  const parts = (process.env.ADMIN_PASSCODE_HASH ?? "").split("$");
  const iterations = Number(parts[1]);
  const okShape =
    parts.length === 4 && parts[0] === "pbkdf2" && Number.isInteger(iterations) && iterations >= 100_000 && /^([0-9a-f]{2}){8,}$/.test(parts[2]) && /^[0-9a-f]{64}$/.test(parts[3]);
  if (!okShape) return "not_configured" as const; // fail closed: no passcode configured = nobody can unlock
  const { hash } = await hashPassword(passcode, parts[2], iterations);
  return safeEqual(hash, parts[3]) ? ("ok" as const) : ("wrong" as const);
}

export const toSession = (u: Doc<"users">) => ({
  id: u._id as string,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  rejectionReason: u.rejectionReason,
});
