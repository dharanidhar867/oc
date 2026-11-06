import { Suspense } from "react";
import type { Metadata } from "next";
import SignupForm from "@/components/views/SignupForm";

export const metadata: Metadata = { title: "Sign up — QuickAI" };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: 700 }} />}>
      <SignupForm />
    </Suspense>
  );
}
