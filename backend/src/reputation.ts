/**
 * reputation.ts — Trust Ledger
 *
 * All reputation data lives in the local agentStore.
 * The local store is the source of truth, kept in sync after every
 * on-chain completeTask / failTask via recordAgentCompletion() / recordAgentFailure().
 */

import { type AgentRecord } from "./agentStore";

export interface ReputationData {
  tasksCompleted: number;
  tasksFailed:    number;
  score:          number;
  lastUpdated:    string; // ISO timestamp
}

export interface ReputationEvent {
  agent:       string;
  taskId:      string;
  score:       number;
  success:     boolean;
  timestamp:   string;
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
  void address;
  return [];
}
