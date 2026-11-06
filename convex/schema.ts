import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(v.literal("student"), v.literal("instructor"), v.literal("admin"));
export const userStatus = v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected"), v.literal("suspended"));
export const courseStatus = v.union(v.literal("draft"), v.literal("in_review"), v.literal("live"), v.literal("rejected"), v.literal("taken_down"));

export default defineSchema({
  users: defineTable({
    name: v.string(),
    username: v.optional(v.string()), // lowercase, unique; lets staff log in with a handle as well as email
    email: v.string(), // lowercase, unique
    role,
    status: userStatus,
    rejectionReason: v.optional(v.string()),
    application: v.optional(
      v.object({ headline: v.string(), teaches: v.string(), bio: v.string(), link: v.optional(v.string()), submittedAt: v.number() }),
    ),
    salt: v.string(),
    hash: v.string(), // PBKDF2-SHA256 of the password; plaintext is never stored
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_role_and_status", ["role", "status"]),

  // Only a SHA-256 of the session token is stored, so a database leak can't be replayed as logins.
  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  // Brute-force protection: repeated failures on an identifier lock logins for a while.
  loginAttempts: defineTable({
    identifier: v.string(),
    failures: v.number(),
    lockedUntil: v.number(),
  }).index("by_identifier", ["identifier"]),

  submissions: defineTable({
    instructorId: v.id("users"),
    instructorName: v.string(),
    title: v.string(),
    subtitle: v.string(),
    category: v.string(),
    level: v.string(),
    price: v.number(),
    description: v.string(),
    thumbnail: v.string(), // resized data URL (size-capped in courses.create)
    promoVideoId: v.optional(v.id("_storage")), // public preview; NOT what gets reviewed — lessons are
    promoDuration: v.optional(v.number()), // seconds, reported by the browser; admins see the real length in the player
    status: courseStatus,
    reason: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_instructorId", ["instructorId"])
    .index("by_status", ["status"]),

  sections: defineTable({
    courseId: v.id("submissions"),
    title: v.string(),
    order: v.number(),
  }).index("by_courseId", ["courseId"]),

  // Every lesson video is reviewed individually by an admin.
  lessons: defineTable({
    courseId: v.id("submissions"),
    sectionId: v.id("sections"),
    instructorId: v.id("users"),
    title: v.string(),
    order: v.number(),
    videoId: v.id("_storage"),
    duration: v.number(), // seconds (max 15 min)
    size: v.number(), // bytes, measured by Convex (max 200 MB)
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reason: v.optional(v.string()),
  })
    .index("by_courseId", ["courseId"])
    .index("by_sectionId", ["sectionId"])
    .index("by_videoId", ["videoId"]),

  // One row per upload slot handed out — drives the "2 lesson uploads per day" limit.
  uploadLog: defineTable({
    instructorId: v.id("users"),
    kind: v.union(v.literal("lesson"), v.literal("promo")),
    at: v.number(),
  }).index("by_instructor_and_kind_and_at", ["instructorId", "kind", "at"]),

  audit: defineTable({
    at: v.number(),
    admin: v.string(),
    action: v.string(),
    target: v.string(),
  }).index("by_at", ["at"]),
});
