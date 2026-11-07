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
    iterations: v.optional(v.number()), // PBKDF2 work factor used for `hash`; missing = 100k (older accounts, upgraded at next login)
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

  // Brute-force protection: after repeated failures on an identifier, logging in needs a CAPTCHA (no hard lock-out,
  // so an attacker can't lock a real user out just by typing wrong passwords).
  loginAttempts: defineTable({
    identifier: v.string(),
    failures: v.number(),
    captchaUntil: v.optional(v.number()),
    lockedUntil: v.optional(v.number()), // LEGACY (old hard lock-out); ignored
  }).index("by_identifier", ["identifier"]),

  // Sign-ups waiting for their emailed code. The account is only created once the code is entered,
  // so sign-up never reveals whether an email is already registered.
  pendingSignups: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("student"), v.literal("instructor")),
    application: v.optional(v.object({ headline: v.string(), teaches: v.string(), bio: v.string(), link: v.optional(v.string()), submittedAt: v.number() })),
    salt: v.string(),
    hash: v.string(),
    iterations: v.optional(v.number()),
    codeHash: v.string(), // SHA-256 of email + code; the code itself is never stored
    attempts: v.number(),
    expiresAt: v.number(),
  }).index("by_email", ["email"]),

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
    promoVideoId: v.optional(v.id("_storage")), // LEGACY (Convex storage) — new promos use promoAssetId
    promoAssetId: v.optional(v.string()), // Gumlet asset id of the public preview; NOT what gets reviewed — lessons are
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
    videoId: v.optional(v.id("_storage")), // LEGACY (Convex storage) — new lessons use assetId
    assetId: v.optional(v.string()), // Gumlet asset id
    duration: v.number(), // seconds (max 15 min)
    size: v.number(), // bytes, as reported by the uploader (max 200 MB)
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reason: v.optional(v.string()),
  })
    .index("by_courseId", ["courseId"])
    .index("by_sectionId", ["sectionId"])
    .index("by_videoId", ["videoId"])
    .index("by_assetId", ["assetId"]),

  // Every Gumlet upload we created. Proves who owns an asset id, so one instructor can't attach another's video.
  videoAssets: defineTable({
    assetId: v.string(),
    instructorId: v.id("users"),
    kind: v.union(v.literal("lesson"), v.literal("promo")),
    status: v.union(v.literal("uploading"), v.literal("ready"), v.literal("errored")),
    used: v.boolean(), // attached to a lesson / course yet
    createdAt: v.number(),
  }).index("by_assetId", ["assetId"]),

  // One row per upload slot handed out — drives the "2 lesson uploads per day" limit.
  uploadLog: defineTable({
    instructorId: v.id("users"),
    kind: v.union(v.literal("lesson"), v.literal("promo")),
    at: v.number(),
  }).index("by_instructor_and_kind_and_at", ["instructorId", "kind", "at"]),

  // A signed-in buyer's cart. Server-side so it needs a real account; nobody can add or read it without a valid session.
  cartItems: defineTable({
    userId: v.id("users"),
    courseId: v.id("submissions"),
    addedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_courseId", ["userId", "courseId"])
    .index("by_courseId", ["courseId"]),

  // One row per checkout attempt. Amounts are integer paise, snapshotted on the server from live prices.
  // Only server code (never the browser) may move an order to "paid"; the payment provider confirms via a signed webhook.
  orders: defineTable({
    userId: v.id("users"),
    items: v.array(v.object({ courseId: v.id("submissions"), title: v.string(), cents: v.number() })),
    totalCents: v.number(),
    currency: v.string(),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed"), v.literal("canceled"), v.literal("expired"), v.literal("refunded")),
    cartHash: v.string(), // identifies the exact cart contents, so repeat clicks reuse one order instead of creating many
    providerRef: v.optional(v.string()), // the gateway's order id for this order (never card data)
    checkoutUrl: v.optional(v.string()), // the gateway's hosted payment page for this order, reused on repeat clicks
    paymentId: v.optional(v.string()), // the gateway's payment id once paid
    createdAt: v.number(),
    expiresAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_cartHash", ["userId", "cartHash"])
    .index("by_providerRef", ["providerRef"])
    .index("by_paymentId", ["paymentId"]),

  // One row per course a student has paid for. Written only by payment code, removed on refund.
  enrollments: defineTable({
    userId: v.id("users"),
    courseId: v.id("submissions"),
    orderId: v.id("orders"),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_courseId", ["userId", "courseId"])
    .index("by_orderId", ["orderId"])
    .index("by_courseId", ["courseId"]),

  // Per-student lesson progress. Written only by learning.ts / video.ts after an ownership check.
  lessonProgress: defineTable({
    userId: v.id("users"),
    courseId: v.id("submissions"),
    lessonId: v.id("lessons"),
    lastWatchedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId_and_courseId", ["userId", "courseId"])
    .index("by_userId_and_lessonId", ["userId", "lessonId"]),

  // Fixed-window rate-limit counters (see model.ts rateLimit). key = "<action>:<subject>".
  rateBuckets: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  audit: defineTable({
    at: v.number(),
    admin: v.string(),
    action: v.string(),
    target: v.string(),
  }).index("by_at", ["at"]),
});
