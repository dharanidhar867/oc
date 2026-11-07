"use client";

import { useEffect, useRef, useState } from "react";

// "Sticker Desk" effects shared across views: a course sticker that flies into the nav cart,
// and a ticket-style toast. Both are purely visual; data still comes from Convex.

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Throw a round sticker of `image` from `from` into the nav cart pill (#nav-cart). */
export function flyToCart(from: HTMLElement | null, image: string) {
  const to = document.getElementById("nav-cart");
  if (!from || !to || reduced()) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const f = document.createElement("div");
  f.className = "flyer";
  f.style.backgroundImage = `url("${image.replace(/"/g, "%22")}")`;
  f.style.backgroundColor = "oklch(0.88 0.09 300)";
  f.style.left = `${a.left + a.width / 2 - 29}px`;
  f.style.top = `${a.top + a.height / 2 - 29}px`;
  document.body.appendChild(f);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  f.animate(
    [
      { transform: "translate(0,0) scale(.6) rotate(0)" },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 140}px) scale(1.15) rotate(-20deg)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(15deg)`, opacity: 0.6 },
    ],
    { duration: 850, easing: "cubic-bezier(.45,0,.3,1)" },
  ).onfinish = () => f.remove();
}

/** Hand-drawn doodle for empty states; it draws itself in. Decorative. */
export function Doodle() {
  return (
    <svg className="doodle" width="150" height="110" viewBox="0 0 150 110" fill="none" stroke="#2b2540" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} style={{ display: "block", margin: "0 auto 12px" }}>
      <path d="M20 90h110M35 90V40l40-22 40 22v50" />
      <path d="M60 90V62h30v28" />
      <path d="M118 20l6-10M128 30l10-4M108 14l-2-10" stroke="oklch(0.75 0.16 40)" />
    </svg>
  );
}

type TicketMsg = { title: string; sub?: string };

/** Show a ticket toast (rendered once by <TicketToast/> in the shell). */
export function ticket(title: string, sub?: string) {
  window.dispatchEvent(new CustomEvent<TicketMsg>("qa:ticket", { detail: { title, sub } }));
}

export function TicketToast() {
  const [msg, setMsg] = useState<TicketMsg | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const on = (e: Event) => {
      setMsg((e as CustomEvent<TicketMsg>).detail);
      setShow(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 4200);
    };
    window.addEventListener("qa:ticket", on);
    return () => {
      window.removeEventListener("qa:ticket", on);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className={`ticket${show ? " show" : ""}`} role="status" aria-live="polite">
      {msg && (
        <>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: "block" }}>{msg.title}</b>
            {msg.sub && <span style={{ color: "#6b6585", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.sub}</span>}
          </div>
          <button onClick={() => setShow(false)} aria-label="Dismiss" style={{ border: 0, background: "none", cursor: "pointer", fontWeight: 800, color: "oklch(0.55 0.2 300)", fontSize: 14, fontFamily: "inherit" }}>
            OK
          </button>
        </>
      )}
    </div>
  );
}
