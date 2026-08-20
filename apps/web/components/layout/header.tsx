"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { WalletConnect } from "./wallet-connect";
import { GlobalSearch } from "./global-search";

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton?: boolean;
  showLogo?: boolean;
}

export function Header({ onMenuClick, showMenuButton = true, showLogo = false }: HeaderProps) {
  return (
    <header className="h-14 flex items-center gap-3 px-3 sm:px-4 md:px-6 flex-shrink-0 border-b border-white/[0.05] sticky top-0 z-30 safe-area-inset"
      style={{ background: "rgba(5,5,12,0.8)", backdropFilter: "blur(20px) saturate(1.5)" }}>

      {showMenuButton && (
        <button onClick={onMenuClick} className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0">
          <Menu className="w-5 h-5" />
        </button>
      )}

      {showLogo && (
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 mr-2 group">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10 group-hover:ring-cyan-500/30 transition-all">
            <Image src="/nord_ai_logo_monogramm.png" alt="Nord-AI" width={28} height={28} className="object-cover w-full h-full" />
          </div>
          <span className="font-bold text-[14px] gradient-text hidden xs:inline">Nord-AI</span>
        </Link>
      )}

      <GlobalSearch />

      <div className="flex items-center gap-2 sm:gap-2.5 ml-auto flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-400">Testnet</span>
        </div>
        <div className="hidden md:block h-4 w-px bg-white/[0.06]" />
        <WalletConnect />
      </div>
    </header>
  );
}
