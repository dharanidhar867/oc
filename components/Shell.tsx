"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATS } from "@/lib/data";
import { DISPLAY, T } from "@/lib/theme";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useStore } from "./store";
import { useAuth } from "./auth";
import { TicketToast } from "./sticker-fx";

function NavBar({ activeCat }: { activeCat: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { q, set } = useStore();
  const { token, user, ready } = useAuth();
  const cartCount = useQuery(api.cart.list, token ? { token } : "skip")?.length ?? 0;
  const onCatalog = pathname === "/courses";

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "oklch(0.97 0.02 95 / .96)", backdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 40px", maxWidth: 1360, margin: "0 auto" }}>
        <Link
          href="/"
          className="nl logo"
          onClick={() => set({ q: "" })}
          style={{ font: `800 28px ${DISPLAY}`, color: T.purple, cursor: "pointer" }}
        >
          quickai<span className="logo-dot" style={{ color: T.orange }}>•</span>
        </Link>
        <Link href="/courses" className="nl" style={{ background: "#fff", borderRadius: 99, padding: "10px 20px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
          Explore ▾
        </Link>
        <div className="nav-search" style={{ flex: 1, background: "#fff", borderRadius: 99, padding: "4px 6px 4px 22px", display: "flex", alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => set({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push("/courses");
            }}
            placeholder="Search for courses, skills, instructors"
            style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontSize: 15, color: T.ink, padding: "8px 0" }}
          />
          <Link href="/courses" className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "5px 18px", borderRadius: 99, cursor: "pointer", fontSize: 14 }}>
            Search
          </Link>
        </div>
        {/* Students only see learning links; the teaching link is for guests and instructors. Admins use their console. */}
        {ready && (!user || user.role === "instructor") && (
          <Link href="/instructor" className="nl navlink" style={{ fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            {user ? "Instructor studio" : "Teach on QuickAI"}
          </Link>
        )}
        {ready && user?.role === "admin" && (
          <Link href="/admin" className="nl navlink" style={{ fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            Admin console
          </Link>
        )}
        {user?.role !== "admin" && (
          <>
            <Link href="/my-courses" className="nl navlink" style={{ fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
              My learning
            </Link>
            {user?.role !== "instructor" && (
              // Re-keyed on every count change, so the pill wobbles and the number rolls in.
              <Link key={cartCount} id="nav-cart" href="/cart" className="nl cart-bump" style={{ display: "inline-block", background: "#fff", borderRadius: 99, padding: "10px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Cart · <span className="roll-num">{cartCount}</span>
              </Link>
            )}
          </>
        )}
        <AuthButtons />
      </div>
      <CategoryChips active={onCatalog ? activeCat : null} onPick={() => set({ q: "" })} />
    </div>
  );
}

/** Category chips with a white "magic pill" that slides to the chip you hover, then back to the active one. */
function CategoryChips({ active, onPick }: { active: string | null; onPick: () => void }) {
  const row = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const moveTo = (name: string | null) => {
    const p = pill.current;
    if (!p) return;
    const el = name ? row.current?.querySelector<HTMLElement>(`[data-cat="${CSS.escape(name)}"]`) : null;
    if (!el) {
      p.style.opacity = "0";
      return;
    }
    p.style.opacity = "1";
    p.style.left = `${el.offsetLeft}px`;
    p.style.width = `${el.offsetWidth}px`;
  };
  useEffect(() => moveTo(active), [active]);

  return (
    <div ref={row} onMouseLeave={() => moveTo(active)} style={{ position: "relative", display: "flex", gap: 6, padding: "0 40px 12px", maxWidth: 1360, margin: "0 auto", overflow: "hidden" }}>
      <span ref={pill} className="magic-pill" style={{ opacity: 0 }} />
      {CATS.map((c) => (
        <Link
          key={c.name}
          data-cat={c.name}
          href={`/courses?category=${encodeURIComponent(c.name)}`}
          className="nl nav-chip"
          onMouseEnter={() => moveTo(c.name)}
          onFocus={() => moveTo(c.name)}
          onClick={onPick}
          style={{ fontSize: 14, fontWeight: 600, padding: "6px 14px", borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

// Reads ?category= (needs Suspense with cacheComponents); fallback is the same nav without the highlight.
function NavWithParams() {
  const cat = useSearchParams().get("category");
  return <NavBar activeCat={cat} />;
}

function Footer() {
  const { user: me, ready } = useAuth();
  const isStudent = !ready || !!me; // "Teach" column is for logged-out visitors only
  const col = (title: string, items: string[]) => (
    <div>
      <b style={{ color: "#fff" }}>{title}</b>
      {items.map((i) => (
        <span key={i}>
          <br />
          {i}
        </span>
      ))}
    </div>
  );
  return (
    <div style={{ background: "#1c1530", color: "#d9d0f0", padding: "44px 40px" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", display: "grid", gridTemplateColumns: isStudent ? "1.4fr 1fr 1fr 1fr" : "1.4fr 1fr 1fr 1fr 1fr", gap: 30, fontSize: 14, lineHeight: 2 }}>
        <div>
          <div style={{ font: `800 26px ${DISPLAY}`, color: "#fff" }}>
            quickai<span style={{ color: T.orange }}>•</span>
          </div>
          <div style={{ lineHeight: 1.6, marginTop: 8, color: "#a99dc9" }}>Learn anything, from anyone, anywhere.</div>
        </div>
        {col("QuickAI", ["About", "Careers", "Blog", "Press"])}
        {!isStudent && col("Teach", ["Become an instructor", "Instructor hub", "Affiliates"])}
        {col("Support", ["Help center", "Contact", "Accessibility", "Refunds"])}
        {col("Legal", ["Terms", "Privacy", "Cookie settings"])}
      </div>
      <div style={{ maxWidth: 1360, margin: "20px auto 0", color: "#a99dc9", fontSize: 13 }}>© 2026 QuickAI, Inc.</div>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLearn = pathname.startsWith("/learn");
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: "var(--display)" }}>
      <Suspense fallback={<NavBar activeCat={null} />}>
        <NavWithParams />
      </Suspense>
      {children}
      {!isLearn && <Footer />}
      <TicketToast />
    </div>
  );
}

function AuthButtons() {
  const { user, ready, logOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!ready) return <span style={{ width: 190, height: 40 }} />; // reserve space; avoids a logged-out flash

  if (!user) {
    return (
      <>
        <Link href="/login" className="nl btn-hover" style={{ fontWeight: 600, fontSize: 15, border: `2px solid ${T.ink}`, borderRadius: 99, padding: "8px 18px" }}>
          Log in
        </Link>
        <Link href="/signup" className="nl btn-hover" style={{ background: T.purple, color: "#fff", borderRadius: 99, padding: "10px 22px", fontWeight: 600, fontSize: 15 }}>
          Sign up
        </Link>
      </>
    );
  }

  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const item: React.CSSProperties = { padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 14, display: "block" };
  return (
    <div style={{ position: "relative" }}>
      <span
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 99, padding: "5px 14px 5px 5px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
      >
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: user.role === "instructor" ? T.orange : T.purple, color: user.role === "instructor" ? T.ink : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{initials}</span>
        {user.name.split(" ")[0]} ▾
      </span>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "absolute", right: 0, top: 48, width: 230, background: "#fff", borderRadius: 20, padding: 8, boxShadow: "0 16px 40px oklch(0.3 0.1 300 / .2)" }}>
          <div style={{ padding: "10px 14px 12px", borderBottom: `1px solid ${T.line}`, marginBottom: 6 }}>
            <div style={{ fontWeight: 800 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            <div style={{ fontSize: 11, fontWeight: 800, marginTop: 6, background: T.yellow, display: "inline-block", padding: "2px 10px", borderRadius: 99, textTransform: "capitalize" }}>{user.role}</div>
          </div>
          <Link href={user.role === "instructor" ? "/instructor" : user.role === "admin" ? "/admin" : "/my-courses"} className="nl" style={item}>
            {user.role === "instructor" ? "Instructor studio" : user.role === "admin" ? "Admin console" : "My learning"}
          </Link>
          <span
            style={{ ...item, color: T.danger }}
            onClick={() => {
              logOut();
              router.push("/");
            }}
          >
            Log out
          </span>
        </div>
      )}
    </div>
  );
}
