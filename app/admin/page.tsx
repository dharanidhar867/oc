import type { Metadata } from "next";
import AdminConsole from "@/components/views/AdminConsole";
import AdminGate from "@/components/views/AdminGate";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "Admin console — QuickAI", robots: { index: false } };

export default function Page() {
  return (
    <RequireAuth role="admin">
      <AdminGate>
        <AdminConsole />
      </AdminGate>
    </RequireAuth>
  );
}
