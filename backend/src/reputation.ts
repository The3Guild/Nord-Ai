/**
 * reputation.ts — Trust Ledger
 *
 * All reputation data lives in the local agentStore.
 * The local store is the source of truth, kept in sync after every
 * on-chain completeTask / failTask via recordAgentCompletion() / recordAgentFailure().
 *
 * Reputation events are persisted to data/reputation-events.json.
 */

import fs from "fs";
import path from "path";
import { type AgentRecord } from "./agentStore";

export interface ReputationData {
  tasksCompleted: number;
  tasksFailed:    number;
  score:          number;
  lastUpdated:    string;
}

export interface ReputationEvent {
  agent:       string;
  taskId:      string;
  score:       number;
  success:     boolean;
  timestamp:   string;
  deployHash?: string;
}

const EVENTS_PATH = path.resolve(__dirname, "..", "data", "reputation-events.json");

let eventsCache: ReputationEvent[] | null = null;

function loadEvents(): ReputationEvent[] {
  if (eventsCache) return eventsCache;
  try {
    const dir = path.dirname(EVENTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(EVENTS_PATH)) {
      eventsCache = JSON.parse(fs.readFileSync(EVENTS_PATH, "utf-8"));
      if (!Array.isArray(eventsCache)) eventsCache = [];
    } else {
      eventsCache = [];
    }
  } catch {
    eventsCache = [];
  }
  return eventsCache;
}

function saveEvents(): void {
  try {
    const dir = path.dirname(EVENTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EVENTS_PATH, JSON.stringify(eventsCache ?? [], null, 2));
  } catch (e) {
    console.warn(`[Reputation] Failed to persist events: ${e}`);
  }
}

export function recordReputationEvent(
  agent: string,
  taskId: string,
  score: number,
  success: boolean,
  deployHash?: string,
): void {
  const event: ReputationEvent = {
    agent,
    taskId,
    score,
    success,
    timestamp: new Date().toISOString(),
    deployHash,
  };
  loadEvents();
  eventsCache!.push(event);
  saveEvents();
  console.log(`[Reputation] Event: agent=${agent.slice(0, 12)}… task=${taskId} success=${success} score=${score}`);
}

export async function getReputation(
  address: string,
  agentRecord?: AgentRecord | null,
): Promise<ReputationData | null> {
  if (!agentRecord) return null;
  return {
    tasksCompleted: agentRecord.tasksCompleted,
    tasksFailed:    agentRecord.tasksFailed,
    score:          agentRecord.reputationScore,
    lastUpdated:    agentRecord.lastUpdated ?? new Date(0).toISOString(),
  };
}

export async function getReputationEvents(address: string): Promise<ReputationEvent[]> {
  return loadEvents().filter(e => e.agent === address);
}
