import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  LOCK_MS,
  MAX_FAILURES,
  createSession,
  getViewer,
  hashPassword,
  isEmail,
  normEmail,
  normUsername,
  passwordProblem,
  safeEqual,
  sha256Hex,
  toSession,
} from "./model";
import { role as roleValidator } from "./schema";

type Fail = { ok: false; error: string; field?: "email" | "password" | "name" };
const fail = (error: string, field?: Fail["field"]): Fail => ({ ok: false, error, field });

export const signUp = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("student"), v.literal("instructor")), // admins can never self-register
    remember: v.optional(v.boolean()),
    application: v.optional(v.object({ headline: v.string(), teaches: v.string(), bio: v.string(), link: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
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

    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existing) return fail("An account with this email already exists. Try logging in instead.", "email");

    const { salt, hash } = await hashPassword(args.password);
    const userId = await ctx.db.insert("users", {
      name,
      email,
      role: args.role,
      status: isTeacher ? "pending" : "approved", // instructors can do nothing until an admin approves them
      application,
      salt,
      hash,
      createdAt: Date.now(),
    });
    const token = await createSession(ctx, userId, args.remember ?? true);
    const user = (await ctx.db.get(userId))!;
    return { ok: true as const, token, session: toSession(user) };
  },
});

export const logIn = mutation({
  args: {
    identifier: v.string(), // email, or username (staff)
    password: v.string(),
    role: roleValidator, // which login page was used
    remember: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identifier = args.identifier.trim().toLowerCase();
    const generic = fail("Incorrect email or password.");
    if (!identifier || identifier.length > 254 || args.password.length > 200) return generic;

    const now = Date.now();
    const attempts = await ctx.db.query("loginAttempts").withIndex("by_identifier", (q) => q.eq("identifier", identifier)).unique();
    if (attempts && attempts.lockedUntil > now) {
      return fail(`Too many failed attempts. Try again in ${Math.ceil((attempts.lockedUntil - now) / 60000)} minute(s).`);
    }

    const user = identifier.includes("@")
      ? await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", identifier)).unique()
      : await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", normUsername(identifier))).unique();

    // Always run the hash (even for unknown users) so response time doesn't reveal which accounts exist.
    const { hash } = await hashPassword(args.password, user?.salt);
    const good = !!user && safeEqual(hash, user.hash);

    if (!good) {
      const failures = (attempts && attempts.lockedUntil <= now && attempts.failures >= MAX_FAILURES ? 0 : (attempts?.failures ?? 0)) + 1;
      const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
      if (attempts) await ctx.db.patch(attempts._id, { failures, lockedUntil });
      else await ctx.db.insert("loginAttempts", { identifier, failures, lockedUntil });
      return generic;
    }
    if (attempts) await ctx.db.delete(attempts._id);

    // Right credentials, wrong login page.
    if (user.role !== args.role) {
      const where = { student: "the Student login", instructor: "the Instructor login", admin: "the Admin login" }[user.role];
      return fail(`This account is ${user.role === "admin" ? "an admin" : "a " + user.role} account. Please use ${where}.`);
    }
    if (user.status === "suspended") return fail("This account has been suspended. Please contact QuickAI support.");

    const token = await createSession(ctx, user._id, args.remember ?? false);
    return { ok: true as const, token, session: toSession(user) };
  },
});

export const logOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (session) await ctx.db.delete(session._id);
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
