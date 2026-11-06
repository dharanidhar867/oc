import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/views/LoginForm";

export const metadata: Metadata = { title: "Log in — QuickAI" };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: 700 }} />}>
      <LoginForm role="student" />
    </Suspense>
  );
}
