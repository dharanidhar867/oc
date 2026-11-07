import type { Metadata } from "next";
import LearnView from "@/components/views/LearnView";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "Learning — QuickAI" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <LearnView id={id} />
    </RequireAuth>
  );
}
