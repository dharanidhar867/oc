// Housekeeping, run by crons.ts. Deletes expired security records in bounded batches.
import { internalMutation } from "./_generated/server";

const BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const s of await ctx.db.query("sessions").take(BATCH * 4)) if (s.expiresAt < now) await ctx.db.delete(s._id);
    for (const u of await ctx.db.query("adminUnlocks").take(BATCH)) {
      if (u.expiresAt < now || !(await ctx.db.get(u.sessionId))) await ctx.db.delete(u._id); // expired, or its session is gone
    }
    for (const p of await ctx.db.query("pendingSignups").take(BATCH)) if (p.expiresAt < now) await ctx.db.delete(p._id);
    for (const a of await ctx.db.query("loginAttempts").take(BATCH)) if ((a.captchaUntil ?? 0) < now - DAY_MS) await ctx.db.delete(a._id);
    for (const r of await ctx.db.query("rateBuckets").take(BATCH * 4)) if (r.windowStart < now - DAY_MS) await ctx.db.delete(r._id);
  },
});
