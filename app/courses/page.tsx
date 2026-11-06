import { Suspense } from "react";
import type { Metadata } from "next";
import CatalogView from "@/components/views/CatalogView";

export const metadata: Metadata = { title: "Courses — QuickAI" };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: 600 }} />}>
      <CatalogView />
    </Suspense>
  );
}
