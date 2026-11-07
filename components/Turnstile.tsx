"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget. The token it produces is checked on the server (convex/captcha.ts); it is one-time use,
// so remount the widget (change its `key`) after every submit. Site key: NEXT_PUBLIC_TURNSTILE_SITE_KEY.

type TurnstileApi = {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  // Inserted by our own (nonce-trusted) code, so the strict CSP's 'strict-dynamic' allows it.
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("captcha script failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export default function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey) {
      console.error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set");
      return;
    }
    let id: string | null = null;
    let live = true;
    loadScript()
      .then(() => {
        if (!live || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey,
          callback: (t) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      live = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  return <div ref={box} style={{ minHeight: 65, margin: "4px 0 14px" }} />;
}
