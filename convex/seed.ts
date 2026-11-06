// Seeding runs only from the CLI / dashboard (internal = not callable from browsers):
//   npx convex run seed:upsertUser '{"name":"...","username":"...","email":"...","password":"...","role":"admin"}'
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { hashPassword, isEmail, normEmail, normUsername, passwordProblem } from "./model";
import { role } from "./schema";

/** Creates the account, or resets its password/role if the email already exists. Safe to re-run. */
export const upsertUser = internalMutation({
  args: { name: v.string(), username: v.optional(v.string()), email: v.string(), password: v.string(), role },
  handler: async (ctx, a) => {
    const email = normEmail(a.email);
    if (!isEmail(email)) throw new Error("Invalid email");
    const pw = passwordProblem(a.password);
    if (pw) throw new Error(pw);
    const username = a.username ? normUsername(a.username) : undefined;
    if (username) {
      const taken = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", username)).unique();
      if (taken && taken.email !== email) throw new Error("Username already used by another account");
    }
    const { salt, hash } = await hashPassword(a.password);
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
    const fields = { name: a.name.trim(), username, email, role: a.role, status: "approved" as const, rejectionReason: undefined, salt, hash };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return `updated ${a.role} ${email}`;
    }
    await ctx.db.insert("users", { ...fields, createdAt: Date.now() });
    return `created ${a.role} ${email}`;
  },
});
