"use client";

import { useCallback, useState } from "react";
import { usePelagus } from "@/contexts/click-context";

interface WalletState {
  connected: boolean;
  address: string;
  connecting: boolean;
  sdkReady: boolean;
  isBlip: boolean;
  error: string | null;
  copied: boolean;
  connect: () => void;
  disconnect: () => void;
  copyAddress: () => void;
  sendTransaction: (tx: { to: string; value: string; data?: string }) => Promise<string>;
  requestAppWalletFunding: (params: {
    chainId: string;
    reason: string;
    continueLabel: string;
    assets: Array<{ type: "native" | "erc20"; symbol: string; decimals: number; amountWei: string; purpose: string; token?: string }>;
  }) => Promise<{ funded: boolean; txHashes: string[]; balances: Record<string, string> }>;
}

export function useWallet(): WalletState {
  const { address, connected, ready, isBlip, error: sdkError, connect: pelagusConnect, disconnect: pelagusDisconnect, sendTransaction, requestAppWalletFunding } = usePelagus();
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await pelagusConnect();
    } finally {
      setConnecting(false);
    }
  }, [pelagusConnect]);

  const disconnect = useCallback(() => {
    pelagusDisconnect();
  }, [pelagusDisconnect]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return {
    connected,
    address: address ?? "",
    connecting: connecting && !connected,
    sdkReady: ready,
    isBlip,
    error: sdkError,
    copied,
    connect,
    disconnect,
    copyAddress,
    sendTransaction,
    requestAppWalletFunding,
  };
}
