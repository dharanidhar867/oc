"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "./auth";

type Props = { kind: "lesson" | "promo"; id: string; style?: CSSProperties };
type State = ({ status: "ready"; url: string; expiresAt: number } | { status: "error"; error: string } | { status: "expired" }) & { key: string };

/**
 * Plays a lesson or promo. The page never holds a permanent video link: it asks the server (video.play) for a
 * short-lived signed link, which the server only issues after checking the viewer may watch. When the link
 * expires the player asks the viewer to continue, which fetches a fresh one.
 */
export default function VideoPlayer({ kind, id, style }: Props) {
  const { token } = useAuth();
  const play = useMutation(api.video.play);
  const [state, setState] = useState<State | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${kind}:${id}:${attempt}:${token ?? ""}`; // a result for an older request is treated as "still loading"

  useEffect(() => {
    let live = true;
    play({ token: token ?? undefined, kind, id })
      .then((r) => live && setState(r.ok ? { key, status: "ready", url: r.url, expiresAt: r.expiresAt } : { key, status: "error", error: r.error }))
      .catch(() => live && setState({ key, status: "error", error: "Couldn’t load this video. Please try again." }));
    return () => {
      live = false;
    };
  }, [play, token, kind, id, key]);

  useEffect(() => {
    if (state?.status !== "ready") return;
    const t = setTimeout(() => setState({ key: state.key, status: "expired" }), Math.max(0, state.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [state]);

  const base: CSSProperties = { display: "block", width: "100%", aspectRatio: "16 / 9", borderRadius: 14, background: "#000", ...style };
  const panel = (content: React.ReactNode) => (
    <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center", padding: 20, fontSize: 15, lineHeight: 1.5 }}>{content}</div>
  );
  const retry = (label: string) => (
    <button onClick={() => setAttempt((n) => n + 1)} style={{ marginTop: 12, border: 0, borderRadius: 99, padding: "10px 20px", fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
      {label}
    </button>
  );

  if (!state || state.key !== key) return panel(null);
  if (state.status === "error") return panel(<div>{state.error}<br />{retry("Try again")}</div>);
  if (state.status === "expired") return panel(<div>This viewing session has ended.<br />{retry("Continue watching")}</div>);
  if (state.url.startsWith("https://play.gumlet.io/")) {
    return (
      <iframe
        src={state.url}
        title="Video player"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ ...base, border: 0 }}
      />
    );
  }
  // Legacy Convex-stored video (staff only; the server never gives these to students).
  return <video src={state.url} controls controlsList="nodownload" preload="metadata" playsInline onContextMenu={(e) => e.preventDefault()} style={base} />;
}
