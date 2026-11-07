"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AuthFail, AuthResult, Role, Session, SignupRole } from "@/lib/auth";
import { DISPLAY, T } from "@/lib/theme";

// The browser only holds an opaque session token. Who you are, what role you have and whether
// you're allowed to do anything is decided by Convex on every request (see /convex).
const TOKEN_KEY = "quickai.token";

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const storeToken = (t: string | null, remember = true) => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
  } catch {}
};

type SignUpInput = {
  name: string;
  email: string;
  password: string;
  role: SignupRole;
  application?: { headline: string; teaches: string; bio: string; link?: string };
  remember?: boolean;
};

type Auth = {
  user: Session | null;
  token: string | null; // pass to Convex functions that need the caller's identity
  ready: boolean; // false until the session has been resolved (avoids a logged-out flash)
  logIn: (i: { email: string; password: string; role: Role; remember?: boolean; captchaToken?: string }) => Promise<AuthResult>;
  /** Step 1: emails a code (or, for an existing account, a notice). The answer never says which. */
  startSignUp: (i: SignUpInput & { captchaToken: string }) => Promise<{ ok: true } | AuthFail>;
  /** Step 2: the emailed code creates the account and signs in. */
  completeSignUp: (i: { email: string; code: string; remember?: boolean }) => Promise<AuthResult>;
  logOut: () => void;
};

const Ctx = createContext<Auth | null>(null);

type ServerResult = { ok: true; token: string; session: Session } | AuthFail;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const logInA = useAction(api.auth.logIn);
  const startSignUpA = useAction(api.auth.startSignUp);
  const completeSignUpM = useMutation(api.auth.completeSignUp);
  const logOutM = useMutation(api.auth.logOut);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setToken(readToken());
    setLoaded(true);
  }, []);

  // Live query: an admin's approval/suspension reaches this browser without a reload.
  const me = useQuery(api.auth.me, token ? { token } : "skip");

  useEffect(() => {
    if (token && me === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- server says the token is expired/revoked
      setToken(null);
      storeToken(null);
    }
  }, [token, me]);

  const finish = useCallback((r: ServerResult, remember: boolean): AuthResult => {
    if (!r.ok) return r;
    storeToken(r.token, remember);
    setToken(r.token);
    return { ok: true, session: r.session };
  }, []);

  const value: Auth = {
    user: token ? (me ?? null) : null,
    token,
    ready: loaded && (!token || me !== undefined),
    logIn: async (i) =>
      finish((await logInA({ identifier: i.email, password: i.password, role: i.role, remember: i.remember, captchaToken: i.captchaToken })) as ServerResult, i.remember ?? false),
    startSignUp: async (i) =>
      (await startSignUpA({ name: i.name, email: i.email, password: i.password, role: i.role, application: i.application, captchaToken: i.captchaToken })) as { ok: true } | AuthFail,
    completeSignUp: async (i) => finish((await completeSignUpM(i)) as ServerResult, i.remember ?? true),
    logOut: () => {
      if (token) logOutM({ token }).catch(() => {});
      storeToken(null);
      setToken(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

const loginPathFor = (role?: Role) => (role === "instructor" ? "/instructor/login" : role === "admin" ? "/admin/login" : "/login");

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 620, margin: "60px auto", padding: "0 24px" }}>
      <div style={{ background: "#fff", borderRadius: 30, padding: 36, textAlign: "center" }}>
        <div style={{ font: `800 28px ${DISPLAY}` }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function Steps({ step }: { step: 0 | 1 | 2 }) {
  const items = ["Application sent", "Admin review", "Approved"];
  return (
    <div style={{ display: "flex", gap: 8, margin: "22px 0", textAlign: "left" }}>
      {items.map((t, i) => {
        const done = i < step, now = i === step;
        return (
          <div key={t} style={{ flex: 1 }}>
            <div style={{ height: 6, borderRadius: 9, background: done ? T.purple : now ? T.orange : T.line }} />
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: done || now ? T.ink : T.muted }}>
              {done ? "✓ " : now ? "● " : ""}
              {t}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Route guard: sends logged-out visitors to the right login page, blocks the wrong role,
 *  and holds instructors back until an admin has approved them. */
export function RequireAuth({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { user, ready, logOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const loginPath = loginPathFor(role);

  useEffect(() => {
    if (ready && !user) router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, loginPath, pathname]);

  if (!ready || !user) return <div style={{ minHeight: "60vh" }} />;

  const switchAccount = (
    <span
      onClick={() => {
        logOut();
        router.push(loginPath);
      }}
      className="btn-hover"
      style={{ border: `2px solid ${T.ink}`, fontWeight: 700, padding: "10px 22px", borderRadius: 99, cursor: "pointer" }}
    >
      Switch account
    </span>
  );
  const home = (
    <Link href="/" className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "12px 24px", borderRadius: 99 }}>
      Back to home
    </Link>
  );
  const buttons = <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>{home}{switchAccount}</div>;

  if (user.status === "suspended") {
    return (
      <Card title="Account suspended">
        <div style={{ color: T.muted2, margin: "10px 0 22px", lineHeight: 1.5 }}>This account has been suspended. Please contact QuickAI support if you think this is a mistake.</div>
        {buttons}
      </Card>
    );
  }

  if (role && user.role !== role) {
    const need = { instructor: "an instructor", student: "a student", admin: "an admin" }[role];
    return (
      <Card title={role === "admin" ? "Admins only" : role === "instructor" ? "Instructors only" : "Students only"}>
        <div style={{ color: T.muted2, margin: "10px 0 22px", lineHeight: 1.5 }}>
          You’re signed in as {user.role === "admin" ? "an admin" : "a " + user.role}. This area needs {need} account.
          {role === "instructor" && user.role === "student" && " Want to teach? Apply with a separate instructor account — every instructor is reviewed by our team before they can publish."}
        </div>
        {role === "instructor" && user.role === "student" ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup?role=instructor" onClick={logOut} className="nl btn-hover" style={{ background: T.orange, fontWeight: 700, padding: "12px 24px", borderRadius: 99 }}>
              Apply to teach
            </Link>
            {switchAccount}
          </div>
        ) : (
          buttons
        )}
      </Card>
    );
  }

  if (role === "instructor" && user.status === "pending") {
    return (
      <Card title="Your application is under review">
        <Steps step={1} />
        <div style={{ color: T.muted2, lineHeight: 1.6, marginBottom: 22 }}>
          Thanks, {user.name.split(" ")[0]}! Our team reviews every instructor before they can create or publish courses. You’ll get access here as soon as you’re approved — this page updates by itself.
        </div>
        {buttons}
      </Card>
    );
  }

  if (role === "instructor" && user.status === "rejected") {
    return (
      <Card title="Application not approved">
        <div style={{ background: "oklch(0.95 0.04 20)", color: "oklch(0.4 0.15 20)", borderRadius: 16, padding: "14px 18px", margin: "0 0 18px", fontWeight: 600, textAlign: "left" }}>
          Reason: {user.rejectionReason || "Not specified."}
        </div>
        <div style={{ color: T.muted2, lineHeight: 1.6, marginBottom: 22 }}>You can still learn on QuickAI with a student account.</div>
        {buttons}
      </Card>
    );
  }

  return <>{children}</>;
}
