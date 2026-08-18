import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // ── Quai Network ────────────────────────────────────────────────────────────
  quaiRpcUrl:     optional("QUAI_RPC_URL",     "https://orchard.rpc.quai.network/cyprus1"),
  quaiChainId:    Number(optional("QUAI_CHAIN_ID", "15000")),
  quaiNetworkName: optional("QUAI_NETWORK_NAME", "orchard-testnet"),

  // ── Coordinator signing key ──────────────────────────────────────────────────
  coordinatorPrivateKey: optional("COORDINATOR_PRIVATE_KEY", ""),

  // ── Deployed Quai contract addresses ────────────────────────────────────────
  contracts: {
    get agentRegistry()   { return required("AGENT_REGISTRY_ADDRESS"); },
    get agentReputation() { return required("AGENT_REPUTATION_ADDRESS"); },
    get taskCoordinator() { return required("TASK_COORDINATOR_ADDRESS"); },
  },

  // ── Quaiscan (block explorer + API) ─────────────────────────────────────────
  quaiscanBaseUrl: optional("QUAISCAN_BASE_URL", "https://orchard.quaiscan.io"),
  quaiscanApiKey:  optional("QUAISCAN_API_KEY",  ""),

  // ── Task creation ─────────────────────────────────────────────────────────────
  // Budget in QUAI (18 decimals). Default: 0.5 QUAI
  taskBudgetQuai: optional("TASK_BUDGET_QUAI", "0.5"),

  // ── Venice AI ────────────────────────────────────────────────────────────────
  get veniceApiKey() { return required("VENICE_API_KEY"); },
  veniceBaseUrl: optional("VENICE_BASE_URL", "https://api.venice.ai/api/v1"),

  // ── Server ───────────────────────────────────────────────────────────────────
  port: Number(optional("PORT", "3000")),
} as const;
