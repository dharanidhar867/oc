// Sign-up, log-in and log-out.
//
// Sign-up never reveals whether an email is registered: every request gets the same "check your email" answer.
// A new address gets a 6-digit code; an address that already has an account gets a "you already have an account" email.
// The account is only created when the code is entered (completeSignUp).
//
// Log-in has no hard lock-out (which would let anyone lock a real user out). After a few failures on an account,
// or when many logins are failing site-wide (credential stuffing), a CAPTCHA is required for every further attempt.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { verifyCaptcha } from "./captcha";
import { sendEmail } from "./email";
import {
  createSession,
  getViewer,
  hashPassword,
  iterationsOf,
  PBKDF2_ITERATIONS,
  isEmail,
  normEmail,
  normUsername,
  passwordProblem,
  rateCount,
  rateLimit,
  safeEqual,
  sha256Hex,
  toSession,
} from "./model";
import { role as roleValidator } from "./schema";

const SIGNUPS_PER_MINUTE = 20; // site-wide
const SIGNUP_EMAILS_PER_HOUR = 5; // per address: stops using our sign-up form to flood someone's inbox
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_ATTEMPTS = 5;
const CAPTCHA_AFTER_FAILURES = 3; // per account
const CAPTCHA_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_FAILS_PER_MINUTE = 30; // above this, every login needs a CAPTCHA for the rest of the minute

type Field = "email" | "password" | "name";
type Fail = { ok: false; error: string; field?: Field; captcha?: true };
const fail = (error: string, field?: Field): Fail => ({ ok: false, error, field });
type Session = ReturnType<typeof toSession>;
type LoginResult = { ok: true; token: string; session: Session } | Fail;

const applicationArg = v.optional(v.object({ headline: v.string(), teaches: v.string(), bio: v.string(), link: v.optional(v.string()) }));
const signupArgs = {
  name: v.string(),
  email: v.string(),
  password: v.string(),
  role: v.union(v.literal("student"), v.literal("instructor")), // admins can never self-register
  application: applicationArg,
};

/** Uniform 6-digit code (rejection sampling, so no digit is more likely than another). */
function newCode() {
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= 4_294_000_000);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/** Step 1 of sign-up. Always answers the same way for valid input, whether or not the email is registered. */
export const startSignUp = action({
  args: { ...signupArgs, captchaToken: v.string() },
  handler: async (ctx, { captchaToken, ...a }): Promise<{ ok: true } | Fail> => {
    if (!(await verifyCaptcha(captchaToken))) return fail("Please complete the “I’m human” check and try again.");
    const r = await ctx.runMutation(internal.auth.prepareSignUp, a);
    if (!r.ok) return r;
    const sent = await sendEmail(r.to, r.subject, r.text);
    return sent ? { ok: true } : fail("We couldn’t send the email right now. Please try again in a few minutes.");
  },
});

/** INTERNAL: validates, rate-limits and prepares the email. Does the same expensive work on both paths so timing reveals nothing. */
export const prepareSignUp = internalMutation({
  args: signupArgs,
  handler: async (ctx, args): Promise<{ ok: true; to: string; subject: string; text: string } | Fail> => {
    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) return fail("Enter your full name.", "name");
    const email = normEmail(args.email);
    if (!isEmail(email)) return fail("That doesn’t look like a valid email.", "email");
    const pw = passwordProblem(args.password);
    if (pw) return fail(pw, "password");

    const isTeacher = args.role === "instructor";
    let application;
    if (isTeacher) {
      const a = args.application;
      if (!a) return fail("Please complete the instructor application.");
      const headline = a.headline.trim(), teaches = a.teaches.trim(), bio = a.bio.trim(), link = a.link?.trim();
      if (headline.length < 5 || headline.length > 140) return fail("Add a short professional headline.");
      if (teaches.length < 2 || teaches.length > 200) return fail("Tell us what you’d like to teach.");
      if (bio.length < 50 || bio.length > 3000) return fail("Tell us about your experience (50–3000 characters).");
      if (link && (link.length > 300 || !/^https?:\/\/\S+\.\S+/.test(link))) return fail("Enter a full link starting with http:// or https://");
      application = { headline, teaches, bio, link: link || undefined, submittedAt: Date.now() };
    }

    // Same limits whether or not the account exists, so hitting them reveals nothing either.
    if (!(await rateLimit(ctx, "signup:global", SIGNUPS_PER_MINUTE, 60_000))) return fail("Lots of people are signing up right now. Please try again in a minute.");
    if (!(await rateLimit(ctx, `signup:${email}`, SIGNUP_EMAILS_PER_HOUR, 60 * 60 * 1000))) return fail("Too many sign-up emails for this address. Please try again later.");

    const { salt, hash, iterations } = await hashPassword(args.password); // done on both paths
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existing) {
      return {
        ok: true,
        to: email,
        subject: "Someone tried to sign up with your email",
        text: `Hi ${existing.name},\n\nSomeone (hopefully you) tried to create a QuickAI account with this email address, but you already have one.\n\nJust log in with your existing password. If this wasn't you, you can ignore this email; nothing has changed on your account.\n\n— QuickAI`,
      };
    }

    const code = newCode();
    const fields = {
      email,
      name,
      role: args.role,
      application,
      salt,
      hash,
      iterations,
      codeHash: await sha256Hex(`${email}:${code}`),
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_MS,
    };
    const pending = await ctx.db.query("pendingSignups").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (pending) await ctx.db.replace(pending._id, fields); // a new request replaces the old code
    else await ctx.db.insert("pendingSignups", fields);
    return {
      ok: true,
      to: email,
      subject: `Your QuickAI code: ${code}`,
      text: `Hi ${name},\n\nYour QuickAI sign-up code is: ${code}\n\nIt expires in 15 minutes. If you didn't try to sign up, you can ignore this email.\n\n— QuickAI`,
    };
  },
});

/** Step 2 of sign-up: the emailed code creates the account and logs in. One generic error for every failure. */
export const completeSignUp = mutation({
  args: { email: v.string(), code: v.string(), remember: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<LoginResult> => {
    const bad = fail("That code is wrong or has expired. Check the email or request a new code.");
    const email = normEmail(args.email);
    const code = args.code.replace(/\s/g, "");
    if (!isEmail(email) || !/^\d{6}$/.test(code)) return bad;

    const p = await ctx.db.query("pendingSignups").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (!p || p.expiresAt < Date.now() || p.attempts >= CODE_ATTEMPTS) return bad;
    if (!safeEqual(await sha256Hex(`${email}:${code}`), p.codeHash)) {
      await ctx.db.patch(p._id, { attempts: p.attempts + 1 });
      return bad;
    }
    await ctx.db.delete(p._id);
    if (await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique()) return bad; // registered meanwhile

    const userId = await ctx.db.insert("users", {
      name: p.name,
      email,
      role: p.role,
      status: p.role === "instructor" ? "pending" : "approved", // instructors can do nothing until an admin approves them
      application: p.application,
      salt: p.salt,
      hash: p.hash,
      iterations: p.iterations, // a code requested before the upgrade carries no count = legacy, upgraded at first login
      createdAt: Date.now(),
    });
    const token = await createSession(ctx, userId, args.remember ?? true);
    return { ok: true, token, session: toSession((await ctx.db.get(userId))!) };
  },
});

async function captchaRequired(ctx: MutationCtx, identifier: string) {
  const a = await ctx.db.query("loginAttempts").withIndex("by_identifier", (q) => q.eq("identifier", identifier)).unique();
  if (a?.captchaUntil && a.captchaUntil > Date.now()) return true;
  return (await rateCount(ctx, "loginfail:global", 60_000)) >= GLOBAL_FAILS_PER_MINUTE;
}

/** Public log-in. An action so it can verify a CAPTCHA with Cloudflare before trying the password. */
export const logIn = action({
  args: {
    identifier: v.string(), // email, or username (staff)
    password: v.string(),
    role: roleValidator, // which login page was used
    remember: v.optional(v.boolean()),
    captchaToken: v.optional(v.string()),
  },
  handler: async (ctx, { captchaToken, ...a }): Promise<LoginResult> => {
    const captchaOk = captchaToken ? await verifyCaptcha(captchaToken) : false;
    return await ctx.runMutation(internal.auth.attemptLogIn, { ...a, captchaOk });
  },
});

/** INTERNAL: the password check itself. Only reachable through logIn (which sets captchaOk honestly). */
export const attemptLogIn = internalMutation({
  args: { identifier: v.string(), password: v.string(), role: roleValidator, remember: v.optional(v.boolean()), captchaOk: v.boolean() },
  handler: async (ctx, args): Promise<LoginResult> => {
    const identifier = args.identifier.trim().toLowerCase();
    const generic = fail("Incorrect email or password.");
    if (!identifier || identifier.length > 254 || args.password.length > 200) return generic;

    if (!args.captchaOk && (await captchaRequired(ctx, identifier))) {
      return { ok: false, error: "For your security, please confirm you’re human, then log in again.", captcha: true };
    }

    const user = identifier.includes("@")
      ? await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", identifier)).unique()
      : await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", normUsername(identifier))).unique();

    // Always run the hash (even for unknown users) so response time doesn't reveal which accounts exist.
    // Each account is checked with the work factor its hash was made with.
    const { hash } = await hashPassword(args.password, user?.salt, user ? iterationsOf(user) : PBKDF2_ITERATIONS);
    const good = !!user && safeEqual(hash, user.hash);
    // Older, weaker hash: compute the replacement now, before knowing whether the password was right, so a cheap
    // legacy check never answers faster than an unknown account (that would reveal which accounts exist).
    const upgrade = user && iterationsOf(user) < PBKDF2_ITERATIONS ? await hashPassword(args.password) : null;
    const attempts = await ctx.db.query("loginAttempts").withIndex("by_identifier", (q) => q.eq("identifier", identifier)).unique();

    if (!good) {
      const now = Date.now();
      const stale = !attempts?.captchaUntil || attempts.captchaUntil <= now; // window over: start counting again
      const failures = (attempts && !(stale && attempts.failures >= CAPTCHA_AFTER_FAILURES) ? attempts.failures : 0) + 1;
      const captchaUntil = failures >= CAPTCHA_AFTER_FAILURES ? now + CAPTCHA_WINDOW_MS : attempts?.captchaUntil;
      if (attempts) await ctx.db.patch(attempts._id, { failures, captchaUntil, lockedUntil: undefined });
      else await ctx.db.insert("loginAttempts", { identifier, failures, captchaUntil });
      await rateLimit(ctx, "loginfail:global", Number.MAX_SAFE_INTEGER, 60_000); // just counts
      return failures >= CAPTCHA_AFTER_FAILURES ? { ...generic, captcha: true } : generic;
    }
    if (attempts) await ctx.db.delete(attempts._id);
    if (upgrade) await ctx.db.patch(user._id, { salt: upgrade.salt, hash: upgrade.hash, iterations: upgrade.iterations });

    // Right credentials, wrong login page.
    if (user.role !== args.role) {
      const where = { student: "the Student login", instructor: "the Instructor login", admin: "the Admin login" }[user.role];
      return fail(`This account is ${user.role === "admin" ? "an admin" : "a " + user.role} account. Please use ${where}.`);
    }
    if (user.status === "suspended") return fail("This account has been suspended. Please contact QuickAI support.");

    const token = await createSession(ctx, user._id, args.remember ?? false);
    return { ok: true, token, session: toSession(user) };
  },
});

export const logOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length > 128) return;
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (session) {
      const u = await ctx.db.query("adminUnlocks").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).unique();
      if (u) await ctx.db.delete(u._id);
      await ctx.db.delete(session._id);
    }
  },
});

/** Reactive current user: approvals/suspensions show up on the client instantly. */
export const me = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await getViewer(ctx, token);
    return user ? toSession(user) : null;
  },
});
