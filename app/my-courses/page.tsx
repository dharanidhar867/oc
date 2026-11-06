import type { Metadata } from "next";
import MineView from "@/components/views/MineView";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "My learning — QuickAI" };

export default function Page() {
  return (
    <RequireAuth>
      <MineView />
    </RequireAuth>
  );
}
