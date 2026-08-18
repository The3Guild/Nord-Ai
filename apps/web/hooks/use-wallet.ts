"use client";

import { useCallback, useState } from "react";
import { usePelagus } from "@/contexts/click-context";

interface WalletState {
  connected: boolean;
  address: string;
  connecting: boolean;
  sdkReady: boolean;
  error: string | null;
  copied: boolean;
  connect: () => void;
  disconnect: () => void;
  copyAddress: () => void;
  sendTransaction: (tx: { to: string; value: string; data?: string }) => Promise<string>;
}

export function useWallet(): WalletState {
  const { address, connected, ready, error: sdkError, connect: pelagusConnect, disconnect: pelagusDisconnect, sendTransaction } = usePelagus();
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
    error: sdkError,
    copied,
    connect,
    disconnect,
    copyAddress,
    sendTransaction,
  };
}
