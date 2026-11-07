// Cloudflare Turnstile ("are you human?") check, done on the server so it can't be skipped from the browser.
// Convex env var: TURNSTILE_SECRET_KEY. Missing key = every check fails (fail closed).
// For testing, Cloudflare's always-pass test pair is: site key 1x00000000000000000000AA / secret 1x0000000000000000000000000000000AA.

/** True only if Cloudflare confirms this one-time token. Tokens can't be reused (Cloudflare rejects replays). Call from actions only. */
export async function verifyCaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[captcha] TURNSTILE_SECRET_KEY is not set: rejecting all captcha checks");
    return false;
  }
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return res.ok && body?.success === true;
  } catch (e) {
    console.error("[captcha] verify failed", e);
    return false;
  }
}
