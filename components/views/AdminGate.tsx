"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import { AuthLayout, Field, FormError, SubmitButton } from "../auth-ui";

// This is only the screen. The passcode is verified by Convex (admin.unlock) and EVERY admin function re-checks the unlock
// on the server, so skipping or tampering with this component gives an attacker an error, not data.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const status = useQuery(api.admin.unlockStatus, token ? { token } : "skip");
  const unlockM = useMutation(api.admin.unlock);
  const lockM = useMutation(api.admin.lock);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Re-lock the screen the moment the server-side unlock expires (the server already refuses by then).
  const [expired, setExpired] = useState(false);

  const expiresAt = status?.unlocked ? status.expiresAt : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when a new unlock arrives
    setExpired(false);
    if (!expiresAt) return;
    const id = setTimeout(() => setExpired(true), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(id);
  }, [expiresAt]);

  if (status === undefined || !token) return <div style={{ minHeight: "60vh" }} />;

  if (status.unlocked && !expired) {
    return (
      <>
        <div style={{ background: "#14101f", textAlign: "right", padding: "8px 40px" }}>
          <button
            onClick={() => lockM({ token }).catch(() => {})}
            style={{ background: "transparent", color: "oklch(0.8 0.05 300)", border: 0, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
          >
            🔒 Lock console
          </button>
        </div>
        {children}
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return setError("Enter your passcode.");
    setLoading(true);
    setError("");
    try {
      const r = await unlockM({ token, passcode });
      if (!r.ok) setError(r.error);
      else setExpired(false);
      setPasscode("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout variant="admin" title="Enter admin passcode" subtitle="Your account is signed in. Enter the passcode to open the console.">
      <form onSubmit={submit} noValidate>
        <FormError>{error}</FormError>
        <Field label="Passcode" type="password" value={passcode} onChange={setPasscode} placeholder="Admin passcode" autoComplete="off" />
        <SubmitButton loading={loading} color={T.orange}>
          Unlock console
        </SubmitButton>
      </form>
      <div style={{ marginTop: 14, fontSize: 13, color: T.muted, textAlign: "center", fontFamily: DISPLAY }}>Locks again automatically after 12 hours.</div>
    </AuthLayout>
  );
}
