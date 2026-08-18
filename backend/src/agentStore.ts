import fs from "fs";
import path from "path";

export interface AgentRecord {
  accountHash:      string;  // Quai address (0x + 40 hex)
  endpoint:         string;
  capability:       string;
  pricePerTask:     string;  // price in wei (base units)
  active:           boolean;
  reputationScore:  number;
  tasksCompleted:   number;
  tasksFailed:      number;
  lastUpdated:      string;   // ISO timestamp of last reputation change
  source:           "on-chain" | "local";
  demo?:            boolean;
  userRating?:      number;
  userRatingCount?: number;
}

const STORE_PATH = path.resolve(__dirname, "..", "data", "agents.json");
const QUAI_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

let agents: Map<string, AgentRecord> = new Map();
let loaded = false;

function loadLocal(): void {
  if (loaded) return;
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
      let removed = 0;
      for (const [k, v] of Object.entries(raw)) {
        const rec = v as AgentRecord;
        if (!QUAI_ADDRESS_RE.test(rec.accountHash || k)) {
          removed++;
          continue;
        }
        agents.set(k, {
          ...rec,
          source:     rec.source ?? "local",
          tasksFailed: rec.tasksFailed ?? 0,
          lastUpdated: rec.lastUpdated ?? new Date(0).toISOString(),
        });
      }
      if (removed > 0) {
        console.warn(`[AgentStore] Removed ${removed} agents with invalid addresses`);
        saveLocal();
      }
    }
  } catch (e) {
    console.warn(`[AgentStore] Failed to load local cache: ${e}`);
  }
  loaded = true;
}

function saveLocal(): void {
  try {
    const obj: Record<string, AgentRecord> = {};
    for (const [k, v] of agents) obj[k] = v;
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.warn(`[AgentStore] Failed to save local cache: ${e}`);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function addAgent(
  address: string,
  endpoint: string,
  capability: string,
  priceWei: string,
  source: "on-chain" | "local" = "local",
): void {
  loadLocal();
  if (!QUAI_ADDRESS_RE.test(address)) {
    console.warn(`[AgentStore] Rejecting invalid address: ${address}`);
    return;
  }
  agents.set(address, {
    accountHash: address,
    endpoint,
    capability,
    pricePerTask: priceWei,
    active: true,
    reputationScore: 5000,
    tasksCompleted: 0,
    tasksFailed: 0,
    lastUpdated: new Date().toISOString(),
    source,
  });
  saveLocal();
}

export function getAllAgents(): AgentRecord[] {
  loadLocal();
  return Array.from(agents.values())
    .filter(a => a.active)
    .sort((a, b) => b.reputationScore - a.reputationScore);
}

export function getAgentsByCapability(capability: string): AgentRecord[] {
  loadLocal();
  return Array.from(agents.values())
    .filter(a => a.active && a.capability === capability)
    .sort((a, b) => b.reputationScore - a.reputationScore);
}

export function updateAgentReputation(address: string, score: number): void {
  loadLocal();
  const agent = agents.get(address);
  if (agent) {
    agent.reputationScore = score;
    agent.lastUpdated = new Date().toISOString();
    agents.set(address, agent);
    saveLocal();
  }
}

function computeScore(completed: number, failed: number): number {
  const total = completed + failed;
  if (total === 0) return 5000;
  const weightedTotal = completed + failed * 2;
  return Math.min(9900, Math.max(100, Math.floor((completed / weightedTotal) * 10000)));
}

export function recordAgentCompletion(address: string): void {
  loadLocal();
  const agent = agents.get(address);
  if (agent) {
    agent.tasksCompleted += 1;
    agent.reputationScore = computeScore(agent.tasksCompleted, agent.tasksFailed);
    agent.lastUpdated = new Date().toISOString();
    agents.set(address, agent);
    saveLocal();
  }
}

export function recordAgentFailure(address: string): void {
  loadLocal();
  const agent = agents.get(address);
  if (agent) {
    agent.tasksFailed += 1;
    agent.reputationScore = computeScore(agent.tasksCompleted, agent.tasksFailed);
    agent.lastUpdated = new Date().toISOString();
    agents.set(address, agent);
    saveLocal();
  }
}

export function rateAgent(
  address: string,
  rating: number,
): { userRating: number; userRatingCount: number } | null {
  loadLocal();
  const agent = agents.get(address);
  if (!agent) return null;

  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  const prevCount = agent.userRatingCount ?? 0;
  const prevTotal = (agent.userRating ?? 0) * prevCount;
  const newCount = prevCount + 1;
  const newRating = Math.round(((prevTotal + clamped) / newCount) * 10) / 10;

  agent.userRating = newRating;
  agent.userRatingCount = newCount;
  agents.set(address, agent);
  saveLocal();

  return { userRating: newRating, userRatingCount: newCount };
}

export async function seedCoordinatorAgents(): Promise<void> {
  loadLocal();
  if (agents.size === 0) {
    console.log(`[AgentStore] No agents registered. Waiting for real agents to self-register on-chain.`);
  }
}

loadLocal();
