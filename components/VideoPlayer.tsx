"use client";

import type { CSSProperties } from "react";

/**
 * Plays a lesson/promo video. New videos are Gumlet embed URLs (shown in Gumlet's player, which streams in every browser);
 * older videos are plain files from Convex storage and use the browser's own player.
 */
export default function VideoPlayer({ src, style }: { src: string; style?: CSSProperties }) {
  const base: CSSProperties = { display: "block", width: "100%", aspectRatio: "16 / 9", borderRadius: 14, background: "#000", ...style };
  if (src.startsWith("https://play.gumlet.io/")) {
    return <iframe src={src} title="Video player" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" style={{ ...base, border: 0 }} />;
  }
  return <video src={src} controls preload="metadata" playsInline style={base} />;
}
