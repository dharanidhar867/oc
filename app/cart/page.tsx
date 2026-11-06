import type { Metadata } from "next";
import CartView from "@/components/views/CartView";

export const metadata: Metadata = { title: "Cart — QuickAI" };

export default function Page() {
  return <CartView />;
}
