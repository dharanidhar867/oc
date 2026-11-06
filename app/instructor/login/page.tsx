import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/views/LoginForm";

export const metadata: Metadata = { title: "Instructor log in — QuickAI" };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: 700 }} />}>
      <LoginForm role="instructor" />
    </Suspense>
  );
}
