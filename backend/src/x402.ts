/**
 * x402.ts — QUAI settlement client
 *
 * Implements the payment flow for NORD-AI using native QUAI transfers
 * on Quai Network. The coordinator wallet pays agents directly via
 * standard QUAI transfers.
 *
 * The x402 adapter pattern is preserved for future HTTP-native agent
 * payments. The core settlement uses direct QUAI transfers for the MVP.
 *
 * Quai uses 18 decimals for QUAI (like ETH on Ethereum).
 */

import { parseQuai } from "quais";
import { config } from "./config";
import { getProvider, getCoordinatorWallet } from "./chain";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SettleResult {
  hash:         string;   // Quai transaction hash
  from:         string;   // payer address
  to:           string;   // payee address
  amount:       string;   // QUAI in base units (wei)
  blockNumber?: number;
}

// ── Address validation ────────────────────────────────────────────────────────

const QUAI_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function isValidQuaiAddress(address: string): boolean {
  return QUAI_ADDRESS_RE.test(address);
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Execute a QUAI transfer from the coordinator wallet to an agent.
 *
 * @param toAddress   Quai address of the agent being paid (0x + 40 hex)
 * @param amountQuai  Payment amount in QUAI (e.g. "0.5")
 * @param label       Human-readable label for logging
 * @returns full payment info including tx hash, from/to, and amount
 */
export async function settlePayment(
  toAddress: string,
  amountQuai: string,
  label?: string,
): Promise<SettleResult> {
  if (!isValidQuaiAddress(toAddress)) {
    throw new Error(
      `[x402] Invalid payTo address: "${toAddress}" — must be 0x followed by 40 hex chars`
    );
  }

  const wallet = getCoordinatorWallet();
  const fromAddress = await wallet.getAddress();
  const value = parseQuai(amountQuai);

  console.log(`[x402] Sending ${amountQuai} QUAI → ${toAddress.slice(0, 14)}…${label ? ` (${label})` : ""}`);

  const tx = await wallet.sendTransaction({
    from: fromAddress,
    to: toAddress,
    value,
  } as any);

  console.log(`[x402] Tx submitted: ${tx.hash}`);
  console.log(`[x402] Explorer: ${config.quaiscanBaseUrl}/tx/${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error(`[x402] Transaction ${tx.hash} produced no receipt`);
  }
  if ("status" in receipt && receipt.status === 0) {
    throw new Error(`[x402] Transaction ${tx.hash} reverted on-chain`);
  }

  console.log(`[x402] ✓ Settled. Block: ${receipt.blockNumber}`);

  return {
    hash: tx.hash,
    from: fromAddress,
    to: toAddress,
    amount: value.toString(),
    blockNumber: receipt.blockNumber ?? undefined,
  };
}

/**
 * Get the coordinator's address.
 */
export async function getCoordinatorAddress(): Promise<string> {
  const wallet = getCoordinatorWallet();
  return wallet.getAddress();
}

/**
 * Get QUAI balance of an address.
 */
export async function getBalance(address: string): Promise<bigint> {
  const provider = getProvider();
  return provider.getBalance(address);
}
