// Strict Content-Security-Policy with a fresh nonce per request (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Only scripts carrying this request's nonce (Next.js adds it to its own scripts), or loaded by them ('strict-dynamic'), may run.
// An injected <script> or inline event handler from an XSS bug is blocked, so it can't steal the login token.
import { NextResponse, type NextRequest } from "next/server";

const convex = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").host;
  } catch {
    return "";
  }
})();

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' only in development (React dev tooling). The Cloudflare host is a fallback for browsers without 'strict-dynamic'.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used throughout the UI; styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `media-src 'self' blob:${convex ? ` https://${convex}` : ""}`,
    // Convex (API + live updates), Gumlet uploads (pre-signed storage URLs), and the dev server's hot reload.
    `connect-src 'self'${convex ? ` https://${convex} wss://${convex}` : ""} https://*.gumlet.io https://*.gumlet.com https://*.amazonaws.com${isDev ? " ws:" : ""}`,
    // Video player and the "I'm human" check are the only frames allowed.
    "frame-src https://play.gumlet.io https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp); // Next.js reads the nonce from here while rendering

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only. Static files, and the ffmpeg worker files (which run under their own rules), are skipped.
      source: "/((?!api|_next/static|_next/image|favicon.ico|ffmpeg/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
