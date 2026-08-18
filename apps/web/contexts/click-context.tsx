"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

declare global {
  interface Window {
    quai?: {
      isPelagus?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

interface WalletContextState {
  address: string | undefined;
  connected: boolean;
  ready: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendTransaction: (tx: { to: string; value: string; data?: string }) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

export function PelagusProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | undefined>();
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = window.quai;
    if (!provider) {
      queueMicrotask(() => setReady(true));
      return;
    }

    let cancelled = false;

    async function checkConnection() {
      try {
        const accounts = await provider!.request({ method: "quai_accounts" }) as string[];
        if (!cancelled && accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setConnected(true);
        }
      } catch {
        // Not connected
      }
      if (!cancelled) setReady(true);
    }

    checkConnection();

    function handleAccountsChanged(accounts: unknown) {
      const accs = accounts as string[];
      if (accs && accs.length > 0) {
        setAddress(accs[0]);
        setConnected(true);
      } else {
        setAddress(undefined);
        setConnected(false);
      }
    }

    provider.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = window.quai;
    if (!provider) {
      setError("Pelagus wallet not detected. Install the Pelagus browser extension.");
      return;
    }
    try {
      setError(null);
      const accounts = await provider.request({ method: "quai_requestAccounts" }) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setConnected(true);
      }
    } catch (e) {
      setError((e as Error).message ?? "Failed to connect wallet");
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setConnected(false);
  }, []);

  const sendTransaction = useCallback(async (tx: { to: string; value: string; data?: string }): Promise<string> => {
    const provider = window.quai;
    if (!provider) throw new Error("Pelagus not available");
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: address, ...tx }],
    });
    return txHash as string;
  }, [address]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const provider = window.quai;
    if (!provider) throw new Error("Pelagus not available");
    const sig = await provider.request({
      method: "personal_sign",
      params: [message, address],
    });
    return sig as string;
  }, [address]);

  return (
    <WalletContext.Provider value={{ address, connected, ready, error, connect, disconnect, sendTransaction, signMessage }}>
      {children}
    </WalletContext.Provider>
  );
}

export function usePelagus(): WalletContextState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("usePelagus must be used within PelagusProvider");
  return ctx;
}
