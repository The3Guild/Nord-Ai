export const CONTRACTS = {
  AGENT_REGISTRY:    process.env.NEXT_PUBLIC_AGENT_REGISTRY    ?? "0x0000000000000000000000000000000000000000",
  AGENT_REPUTATION:  process.env.NEXT_PUBLIC_AGENT_REPUTATION  ?? "0x0000000000000000000000000000000000000000",
  TASK_COORDINATOR:  process.env.NEXT_PUBLIC_TASK_COORDINATOR  ?? "0x0000000000000000000000000000000000000000",
};

export const CHAIN_ID = 15000;

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

export const CAPABILITIES = ["research", "risk", "coding", "design", "audit", "report"] as const;
export type Capability = typeof CAPABILITIES[number];

export const QUAI_EXPLORER = "https://orchard.quaiscan.io";
