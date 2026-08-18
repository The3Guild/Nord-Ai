/**
 * quaiHandler.ts — Quai Network utilities
 *
 * Provides retry logic and provider helpers for Quai RPC operations.
 * Replaces the previous Casper-specific handler.
 */

import { getProvider } from "./chain";

/**
 * Retry a Quai RPC operation with exponential backoff.
 * @param fn      The async operation to retry
 * @param label   Human-readable label for log messages
 * @param maxAttempts  Maximum number of attempts (default: 3)
 * @param baseDelayMs  Base delay in ms (default: 2000, doubles each attempt)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 2000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Retry] ${label} failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}. Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`[Retry] ${label} failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

/**
 * Wait for a Quai transaction to be confirmed.
 * Polls getTransactionReceipt until confirmed or timeout.
 */
export async function waitForTx(
  txHash: string,
  maxAttempts = 40,
  pollIntervalMs = 3000,
): Promise<void> {
  const provider = getProvider();
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status === 0) {
          throw new Error(`Transaction ${txHash} reverted on-chain`);
        }
        console.log(`[Quai] ✓ Tx ${txHash.slice(0, 18)}… confirmed at block ${receipt.blockNumber}`);
        return;
      }
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.startsWith("Transaction")) throw e;
      // Transient errors — keep polling
    }
    if (i > 0 && i % 10 === 0) {
      console.log(`[Quai] Still waiting for ${txHash.slice(0, 18)}… (attempt ${i + 1}/${maxAttempts})`);
    }
  }
  throw new Error(`Transaction ${txHash} not confirmed after ${maxAttempts * pollIntervalMs / 1000}s`);
}
