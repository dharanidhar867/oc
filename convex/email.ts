// Transactional email via Resend. Call from actions only (uses fetch).
// Convex env vars: RESEND_API_KEY, EMAIL_FROM (e.g. "QuickAI <no-reply@yourdomain.com>").
// TESTING ONLY: EMAIL_DEV_LOG=on prints emails (including sign-up codes) to the Convex logs instead of sending. Never on production.

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.EMAIL_DEV_LOG === "on") {
      console.log(`[email:dev] to=${to} | ${subject}\n${text}`);
      return true;
    }
    console.error("[email] RESEND_API_KEY / EMAIL_FROM not set: email not sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error("[email] send failed", res.status);
    return res.ok;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
