import type { Metadata } from "next";
import { connection } from "next/server";
import { Bricolage_Grotesque, Space_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/components/store";
import { AuthProvider } from "@/components/auth";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import Shell from "@/components/Shell";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"], // variable font: opsz 12..96, wght 200..800 (design uses 400/600/800)
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "QuickAI — Learn anything. Start in minutes.",
  description:
    "14,000 courses in code, design, business, music, languages and more. Learn at your pace, own it for life.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request, so Next.js can stamp this request's CSP nonce (proxy.ts) on its scripts.
  await connection();
  return (
    <html lang="en" className={`${bricolage.variable} ${spaceMono.variable}`}>
      <body>
        <ConvexClientProvider>
          <AuthProvider>
            <StoreProvider>
              <Shell>{children}</Shell>
            </StoreProvider>
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
