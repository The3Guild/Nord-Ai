/**
 * chain.ts — Quai Network client
 *
 * All on-chain reads and writes go through quais (ethers.js fork)
 * pointed at the Quai Network via JSON-RPC.
 */

import { quais } from "quais";
import { config } from "./config";

// ── Lazy provider singleton ────────────────────────────────────────────────────

let _provider: quais.JsonRpcProvider | null = null;

export function getProvider(): quais.JsonRpcProvider {
  if (!_provider) {
    _provider = new quais.JsonRpcProvider(
      config.quaiRpcUrl,
      undefined,
      { usePathing: true },
    );
  }
  return _provider;
}

// ── Lazy wallet singleton (coordinator signer) ─────────────────────────────────

let _wallet: quais.Wallet | null = null;

export function getCoordinatorWallet(): quais.Wallet {
  if (!_wallet) {
    if (!config.coordinatorPrivateKey) {
      throw new Error("COORDINATOR_PRIVATE_KEY not set in env");
    }
    _wallet = new quais.Wallet(config.coordinatorPrivateKey, getProvider());
  }
  return _wallet;
}

// ── Quaiscan API helper ────────────────────────────────────────────────────────

export async function quaiscanGet(params: Record<string, string>): Promise<unknown> {
  const url = new URL("/api", config.quaiscanBaseUrl);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  if (config.quaiscanApiKey) {
    url.searchParams.set("apikey", config.quaiscanApiKey);
  }
  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Quaiscan GET ${url.pathname} → HTTP ${res.status}`);
  return res.json();
}
