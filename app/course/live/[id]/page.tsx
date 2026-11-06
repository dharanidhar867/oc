import type { Metadata } from "next";
import LiveCourseView from "@/components/views/LiveCourseView";

export const metadata: Metadata = { title: "Course — QuickAI" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveCourseView id={id} />;
}
