import type { Metadata } from "next";
import CartView from "@/components/views/CartView";
import { RequireAuth } from "@/components/auth";

export const metadata: Metadata = { title: "Cart — QuickAI" };

export default function Page() {
  return (
    <RequireAuth role="student">
      <CartView />
    </RequireAuth>
  );
}
