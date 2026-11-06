import type { Metadata } from "next";
import TeachView from "@/components/views/TeachView";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "Instructor studio — QuickAI" };

export default function Page() {
  return (
    <RequireAuth role="instructor">
      <TeachView />
    </RequireAuth>
  );
}
