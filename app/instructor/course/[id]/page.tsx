import type { Metadata } from "next";
import CourseEditor from "@/components/views/CourseEditor";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "Course lessons — QuickAI" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth role="instructor">
      <CourseEditor id={id} />
    </RequireAuth>
  );
}
