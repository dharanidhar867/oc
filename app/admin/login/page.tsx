import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/views/LoginForm";

export const metadata: Metadata = { title: "Admin log in — QuickAI", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: 700 }} />}>
      <LoginForm role="admin" />
    </Suspense>
  );
}
