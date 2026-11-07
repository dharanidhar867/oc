import type { Metadata } from "next";
import CheckoutView from "@/components/views/CheckoutView";
import { RequireAuth } from "@/components/auth";

// Payment pages must never be indexed or cached.
export const metadata: Metadata = { title: "Secure checkout — QuickAI", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <RequireAuth role="student">
      <CheckoutView orderId={orderId} />
    </RequireAuth>
  );
}
