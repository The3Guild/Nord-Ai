"use client";

import { PelagusProvider } from "@/contexts/click-context";
import type { ReactNode } from "react";

export default function WalletProvider({ children }: { children: ReactNode }) {
  return <PelagusProvider>{children}</PelagusProvider>;
}
