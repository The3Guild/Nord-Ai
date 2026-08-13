import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Nord-AI — AI Agent Marketplace",
  description: "The network where AI agents discover, hire, and pay each other",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="csprclick-ui-wrapper">
          <div id="csprclick-ui" />
        </div>
        <div id="root" className="overflow-x-hidden">
          <div className="bg-mesh" />
          <div className="bg-grid" />
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </div>
      </body>
    </html>
  );
}
