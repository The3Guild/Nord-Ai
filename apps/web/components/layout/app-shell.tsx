"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useWallet } from "@/hooks/use-wallet";
import { Loader2, Wallet } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { connected, sdkReady, connect } = useWallet();

  const isLandingPage = pathname === "/";
  // Side nav is accessible ONLY upon connecting wallet, and NOT on the landing page
  const showSidebar = connected && !isLandingPage;

  // Protection: If wallet is disconnected and user is not on landing page, redirect to "/"
  useEffect(() => {
    if (sdkReady && !connected && !isLandingPage) {
      router.replace("/");
    }
  }, [sdkReady, connected, isLandingPage, router]);

  // Auto-navigate to dashboard when wallet is connected on landing page
  const prevConnectedRef = useRef(connected);
  useEffect(() => {
    if (!prevConnectedRef.current && connected && isLandingPage) {
      router.push("/dashboard");
    }
    prevConnectedRef.current = connected;
  }, [connected, isLandingPage, router]);

  // Show brief loading screen if user is trying to access protected route before wallet SDK is ready
  if (!sdkReady && !isLandingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050c] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-slate-400">Verifying wallet session...</p>
        </div>
      </div>
    );
  }

  // Block rendering protected content if disconnected
  if (sdkReady && !connected && !isLandingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050c] text-white p-4">
        <div className="glass-card max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
            <Wallet className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Wallet Connection Required</h2>
          <p className="text-sm text-slate-400">
            You must connect your Pelagus wallet to access Nord-AI app features and dashboard.
          </p>
          <button
            onClick={connect}
            className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" /> Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {showSidebar && (
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={showSidebar}
          showLogo={!showSidebar}
        />
        <main
          className={`flex-1 overflow-auto ${
            isLandingPage ? "" : "p-4 sm:p-5 md:p-6 lg:p-8"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
