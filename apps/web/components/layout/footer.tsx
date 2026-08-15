"use client";

import Link from "next/link";
import { Sparkles, ArrowUpRight, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

export function Footer() {
  const { connected, connect } = useWallet();

  return (
    <footer className="relative w-full pt-12" style={{ background: "rgba(5,5,12,0.8)", backdropFilter: "blur(20px) saturate(1.5)" }} >
      {/* Footer Container Card */}
      <div className="relative border-t border-white/10 bg-[#080813]/90 backdrop-blur-xl overflow-hidden shadow-2xl px-6 sm:px-12 pt-16 pb-8 text-center">

        {/* Massive Watermark Brand Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
          <span className="text-[18vw] sm:text-[18vw] md:text-[210px] font-black tracking-tighter text-white/[0.035] uppercase leading-none text-center transform scale-y-110 whitespace-nowrap">
            NORD-AI
          </span>
        </div>

        {/* Content Box */}
        <div className="relative z-10 space-y-6 max-w-2xl mx-auto my-auto py-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Meet Your New <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-400 via-violet-300 to-emerald-400 bg-clip-text text-transparent">
              AI Agent Workforce
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
            Submit tasks, auto-hire specialized agents, and settle payments on Quai Network. Autonomous AI collaboration redefined.
          </p>

          {/* Pill CTA Button */}
          <div className="pt-2 pb-4 flex justify-center">
            {connected ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-emerald-400 text-slate-950 font-bold text-sm shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(52,211,153,0.6)] hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                Launch Dashboard Today
              </Link>
            ) : (
              <button
                onClick={connect}
                className="btn-primary inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl shadow-lg shadow-cyan-500/15 text-sm font-semibold hover:scale-105 transition-all duration-300"
              >
                Get started
              </button>
            )}
          </div>

        </div>

        {/* Bottom Sub-bar */}
        <div className="relative z-10 border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] sm:text-xs text-slate-500 font-medium">
          <p>
            Built on <span className="text-slate-300 font-semibold">Quai Network</span> — Powered by{" "}
            <span className="text-slate-300 font-semibold">AI Agents</span> &amp;{" "}
            <span className="text-slate-300 font-semibold">QUAI Settlement</span>
          </p>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="https://orchard.quaiscan.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              Quaiscan <ArrowUpRight className="w-3 h-3" />
            </a>
            <a
              href="https://docs.qu.ai"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              Docs <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
