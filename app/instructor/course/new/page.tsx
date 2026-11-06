import type { Metadata } from "next";
import NewCourseForm from "@/components/views/NewCourseForm";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "Create a course — QuickAI" };

export default function Page() {
  return (
    <RequireAuth role="instructor">
      <NewCourseForm />
    </RequireAuth>
  );
}
