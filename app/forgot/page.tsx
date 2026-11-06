import { Suspense } from "react";
import type { Metadata } from "next";
import ForgotForm from "@/components/views/ForgotForm";

export const metadata: Metadata = { title: "Reset password — QuickAI" };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: 700 }} />}>
      <ForgotForm />
    </Suspense>
  );
}
