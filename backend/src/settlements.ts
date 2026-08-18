/**
 * settlements.ts — QUAI settlement persistence
 *
 * Persists settlement records to data/settlements.json.
 * Each record captures a successful payment for history tracking.
 */

import fs from "fs";
import path from "path";

export interface SettlementRecord {
  hash:        string;  // Quai transaction hash
  from:        string;  // payer address
  to:          string;  // payee address
  amount:      string;  // token amount in base units (wei)
  capability:  string;  // agent capability (e.g. "research")
  taskId:      string;  // task ID string
  timestamp:   string;  // ISO timestamp
}

const STORE_PATH = path.resolve(__dirname, "..", "data", "settlements.json");

let settlements: SettlementRecord[] | null = null;

function load(): SettlementRecord[] {
  if (settlements) return settlements;
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(STORE_PATH)) {
      settlements = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
      if (!Array.isArray(settlements)) settlements = [];
    } else {
      settlements = [];
    }
  } catch {
    settlements = [];
  }
  return settlements;
}

function save(): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(settlements ?? [], null, 2));
  } catch (e) {
    console.warn(`[Settlements] Failed to persist: ${e}`);
  }
}

export function addSettlement(record: Omit<SettlementRecord, "timestamp"> & { timestamp?: string }): void {
  const entry: SettlementRecord = {
    ...record,
    timestamp: record.timestamp ?? new Date().toISOString(),
  };
  load();
  settlements!.push(entry);
  save();
  console.log(`[Settlements] Recorded ${entry.hash.slice(0, 12)}… → ${entry.to.slice(0, 12)}… (${entry.amount} wei)`);
}

export function getSettlements(): SettlementRecord[] {
  return load();
}

export function getSettlementsByAgent(address: string): SettlementRecord[] {
  return load().filter(s => s.to === address);
}
