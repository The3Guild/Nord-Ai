/**
 * coordinator.ts — NORD-AI orchestration loop (Quai Network)
 *
 * All on-chain interactions target deployed Quai Network contracts.
 * Agent payments use direct QUAI transfers from the coordinator wallet.
 *
 * Flow per task (matches TaskCoordinator.sol lifecycle):
 *   1. createTask      — create task on-chain with capability, budget, zone
 *   2. discover agents  — query AgentRegistry (local cache)
 *   3. assignAgent     — call TaskCoordinator on Quai
 *   4. QUAI settle     — direct QUAI transfer to agent
 *   5. submitEvidence   — store result hash on-chain
 *   6. verifyTask      — requester confirms evidence
 *   7. completeTask    — triggers on-chain settlement and reputation update
 */

import crypto from "crypto";
import { quais, parseQuai } from "quais";
import { config } from "./config";
import { getProvider, getCoordinatorWallet } from "./chain";
import { settlePayment } from "./x402";
import { veniceChat } from "./agents/venice";
import { withRetry, waitForTx } from "./quaiHandler";
import { addSettlement } from "./settlements";
import {
  getAllAgents,
  getAgentsByCapability,
  type AgentRecord,
} from "./agentStore";

// ── Contract ABIs ─────────────────────────────────────────────────────────────

const TASK_COORDINATOR_ABI = [
  "function createTask(string _capability, uint256 _budget, uint256 _zone) payable returns (uint256)",
  "function assignAgent(uint256 _taskId, address _agent)",
  "function submitEvidence(uint256 _taskId, bytes32 _resultHash)",
  "function verifyTask(uint256 _taskId)",
  "function completeTask(uint256 _taskId)",
  "function failTask(uint256 _taskId, string _reason)",
  "function getTask(uint256 _taskId) view returns (tuple(address requester, string capability, uint256 budget, address selectedAgent, uint256 zone, uint8 status, uint256 deadline, bytes32 resultHash))",
  "function getTaskCount() view returns (uint256)",
  "function taskCount() view returns (uint256)",
];



// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskResult {
  taskId:              string;
  research?:           string;
  riskAnalysis?:       string;
  coding?:             string;
  design?:             string;
  audit?:              string;
  report:              string;
  agentsHired:         string[];
  txHashes:            string[];
  explorerLinks:       string[];
  onChain:             boolean;
}

// ── Contract instances (lazy) ──────────────────────────────────────────────────

function getTaskCoordinatorContract(signerOrProvider?: quais.JsonRpcProvider | quais.Wallet) {
  const provider = signerOrProvider ?? getProvider();
  return new quais.Contract(config.contracts.taskCoordinator, TASK_COORDINATOR_ABI, provider);
}

function getTaskCoordinatorWithSigner() {
  return new quais.Contract(config.contracts.taskCoordinator, TASK_COORDINATOR_ABI, getCoordinatorWallet());
}

// ── Agent discovery ───────────────────────────────────────────────────────────

export async function findAllAgents(): Promise<AgentRecord[]> {
  return getAllAgents();
}

async function findAgents(capability: string): Promise<AgentRecord[]> {
  const all = getAgentsByCapability(capability);
  const external = all.filter(a => a.source === "on-chain");
  if (external.length > 0) {
    console.log(`[Coordinator] ${capability}: ${external.length} external agent(s) available`);
    return external;
  }
  return all;
}

// ── Query contract state ──────────────────────────────────────────────────────

export async function queryContractVar(varName: string): Promise<bigint | undefined> {
  try {
    const contract = getTaskCoordinatorContract();
    const result = await contract[varName]();
    return BigInt(result.toString());
  } catch (err) {
    console.warn(`[Coordinator] queryContractVar(${varName}) failed: ${err}`);
    return undefined;
  }
}

// ── On-chain contract calls via quais ─────────────────────────────────────────

/**
 * Send a write transaction to the TaskCoordinator contract.
 */
async function callContractWrite(
  functionName: string,
  args: unknown[],
  value?: bigint,
): Promise<string> {
  const contract = getTaskCoordinatorWithSigner();
  const txOptions: Record<string, unknown> = {};
  if (value !== undefined && value > 0n) {
    txOptions.value = value;
  }

  console.log(`[Coordinator] → ${functionName}(${args.map(a => typeof a === "string" ? `"${a.slice(0, 30)}…"` : a).join(", ")})`);

  const tx = await contract[functionName](...args, txOptions);
  console.log(`[Coordinator]   tx: ${tx.hash}`);

  await waitForTx(tx.hash);
  return tx.hash;
}

// ── Agent execution: real A2A HTTP call → Venice fallback ─────────────────────

async function callAgent(
  capability:      string,
  taskDescription: string,
  context = "",
  agent?:          AgentRecord,
): Promise<{ output: string; viaAgent: boolean }> {
  const prompt = context
    ? `Task: ${taskDescription}\n\nContext:\n${context}`
    : taskDescription;

  // Try real A2A HTTP call if agent has a valid endpoint
  if (agent?.endpoint && agent.endpoint.startsWith("http")) {
    try {
      console.log(`[Coordinator] A2A → ${capability} agent at ${agent.endpoint}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(agent.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability,
          description:  taskDescription,
          context,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Agent endpoint returned HTTP ${response.status}`);
      }

      const data = await response.json() as { output?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.output?.trim()) throw new Error("Agent returned empty output");

      console.log(`[Coordinator] ✓ A2A ${capability} agent responded (${data.output.length} chars)`);
      return { output: data.output, viaAgent: true };
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.warn(`[Coordinator] A2A ${capability} agent failed (${msg.slice(0, 100)}), falling back to Venice AI`);
    }
  }

  // Fallback: local Venice AI inference
  const SYSTEM_MAP: Record<string, string> = {
    research: "You are a market research specialist. Produce concise, factual research: key players, market size, growth trends.",
    risk:     "You are a risk analysis specialist. Identify key risks and rate each High/Medium/Low. Be concise.",
    coding:   "You are a senior software engineer. Output ONLY complete, runnable code. No explanations.",
    design:   "You are a UI/UX design specialist. Produce detailed design specifications.",
    audit:    "You are a quality auditor. Review outputs for accuracy. Give a verdict (PASS/FAIL/NEEDS_REVISION).",
    report:   "You are a deliverable compiler. Match output format to what was requested.",
  };
  console.log(`[Coordinator] Venice fallback for ${capability}`);
  const output = await veniceChat(SYSTEM_MAP[capability] ?? SYSTEM_MAP.research, prompt, "llama-3.3-70b");
  return { output, viaAgent: false };
}

// ── assignAndPay: on-chain assign + QUAI payment ─────────────────────────────

async function assignAndPay(
  agent:     AgentRecord,
  taskId:    bigint,
  result:    TaskResult,
): Promise<void> {
  // 1. Assign agent on Quai chain (TaskCoordinator.assignAgent)
  const assignHash = await withRetry(
    () => callContractWrite("assignAgent", [taskId, agent.accountHash]),
    "assignAgent",
    2,
    3000,
  );
  result.agentsHired.push(agent.accountHash);
  result.explorerLinks.push(`${config.quaiscanBaseUrl}/tx/${assignHash}`);

  // 2. Direct QUAI payment to agent
  const amountQuai = (Number(agent.pricePerTask) / 1e18).toFixed(4) || config.taskBudgetQuai;
  try {
    const settleResult = await settlePayment(
      agent.accountHash,
      amountQuai,
      agent.capability,
    );
    result.txHashes.push(settleResult.hash);
    result.explorerLinks.push(`${config.quaiscanBaseUrl}/tx/${settleResult.hash}`);

    // Persist settlement record
    try {
      addSettlement({
        hash:       settleResult.hash,
        from:       settleResult.from,
        to:         settleResult.to,
        amount:     settleResult.amount,
        capability: agent.capability,
        taskId:     String(taskId),
      });
    } catch (e) {
      console.warn(`[Coordinator] Failed to persist settlement: ${e}`);
    }
  } catch (err) {
    console.warn(`[Coordinator] QUAI payment for ${agent.capability} failed (non-fatal): ${err}`);
  }
}

// ── Complete task on-chain: submitEvidence → verifyTask → completeTask ────────

async function completeTaskOnChain(
  taskId:       bigint,
  resultHash:   string,
  agentsHired:  AgentRecord[],
): Promise<void> {
  try {
    // Contract lifecycle: submitEvidence → verifyTask → completeTask
    // 1. Submit evidence (result hash)
    const resultHashBytes = quais.keccak256(quais.toUtf8Bytes(resultHash));
    await withRetry(
      () => callContractWrite("submitEvidence", [taskId, resultHashBytes]),
      "submitEvidence",
      2,
      3000,
    );
    void resultHash;
    console.log(`[Coordinator] Evidence submitted for task ${taskId}`);

    // 2. Verify task — requester confirms evidence
    await withRetry(
      () => callContractWrite("verifyTask", [taskId]),
      "verifyTask",
      2,
      3000,
    );
    console.log(`[Coordinator] Task ${taskId} verified on-chain`);

    // 3. Complete task — triggers internal settlement in the contract
    await withRetry(
      () => callContractWrite("completeTask", [taskId]),
      "completeTask",
      2,
      3000,
    );
    console.log(`[Coordinator] Task ${taskId} completed on-chain`);

    // Update local reputation
    for (const agent of agentsHired) {
      try {
        const { recordAgentCompletion } = await import("./agentStore");
        recordAgentCompletion(agent.accountHash);
      } catch {
        // Reputation update is non-critical
      }
    }
  } catch (err) {
    console.warn(`[Coordinator] completeTask failed (non-fatal): ${err}`);
  }
}

// ── Main orchestration loop ───────────────────────────────────────────────────

let _nextTaskId = 0n;

export async function runCoordinator(
  taskDescription: string,
  capabilities: string[] = ["research", "risk", "audit", "report"],
): Promise<TaskResult> {

  const result: TaskResult = {
    taskId:              "",
    report:              "",
    agentsHired:         [],
    txHashes:            [],
    explorerLinks:       [],
    onChain:             false,
  };

  // ── Query real task ID from contract state (fallback to local counter) ─────
  let TASK_ID: bigint;
  try {
    TASK_ID = (await queryContractVar("taskCount")) ?? _nextTaskId++;
    console.log(`[Coordinator] Real TASK_ID = ${TASK_ID}`);
  } catch {
    TASK_ID = _nextTaskId++;
    console.warn(`[Coordinator] Could not query taskCount, using local ID ${TASK_ID}`);
  }

  // ── Create task on Quai (with retry) ─────────────────────────────────────
  // TaskCoordinator.createTask requires (capability, budget, zone)
  let onChain = false;
  const primaryCapability = capabilities[0] ?? "research";
  const zoneMap: Record<string, number> = {
    research: 0, rwa: 1, risk: 2, audit: 3, coding: 4, design: 4, report: 3,
  };
  const zoneIndex = zoneMap[primaryCapability] ?? 0;
  const budgetWei = parseQuai(config.taskBudgetQuai);

  try {
    console.log(`[Coordinator] Creating task on Quai (capability: ${primaryCapability}, budget: ${config.taskBudgetQuai} QUAI, zone: ${zoneIndex})…`);
    const createHash = await withRetry(
      () => callContractWrite(
        "createTask",
        [primaryCapability, budgetWei, zoneIndex],
        budgetWei,
      ),
      "createTask",
      2,
      5000,
    );
    result.explorerLinks.push(`${config.quaiscanBaseUrl}/tx/${createHash}`);
    onChain = true;
    result.onChain = true;
    console.log(`[Coordinator] Task ${TASK_ID} created on-chain → ${createHash}`);
  } catch (err) {
    console.warn(`[Coordinator] createTask failed — proceeding without on-chain task: ${err}`);
  }
  result.taskId = String(TASK_ID);

  // ── Discover agents (non-blocking — AI runs regardless) ────────────────────
  const agentMap: Partial<Record<string, AgentRecord>> = {};
  await Promise.all(capabilities.map(async cap => {
    const found = await findAgents(cap);
    if (found[0]) {
      agentMap[cap] = found[0];
      console.log(`[Coordinator] Found ${cap} agent: ${found[0].accountHash.slice(0, 14)}… (rep=${found[0].reputationScore}, source=${found[0].source})`);
    } else {
      console.warn(`[Coordinator] No ${cap} agent registered — will run AI without on-chain assignment`);
    }
  }));

  // ── Wave 1: independent capabilities (parallel A2A or Venice) ────────────
  const dependents = ["risk", "audit", "report"];
  const wave1 = capabilities.filter(c => !dependents.includes(c));

  if (wave1.length) {
    console.log(`[Coordinator] Wave 1 (parallel A2A): ${wave1.join(", ")}`);
    const results = await Promise.all(wave1.map(c => callAgent(c, taskDescription, "", agentMap[c])));

    for (let i = 0; i < wave1.length; i++) {
      const cap = wave1[i];
      const { output } = results[i];
      if (cap === "research")     result.research = output;
      else if (cap === "coding")  result.coding   = output;
      else if (cap === "design")  result.design   = output;
      else result.research = (result.research ?? "") + `\n\n[${cap.toUpperCase()}]\n${output}`;

      if (agentMap[cap]) {
        try {
          await assignAndPay(agentMap[cap]!, TASK_ID, result);
        } catch (err) {
          console.warn(`[Coordinator] assignAndPay for ${cap} failed (non-fatal): ${err}`);
        }
      }
    }
  }

  // ── Wave 2: risk (depends on research) ─────────────────────────────────────
  if (capabilities.includes("risk")) {
    console.log("[Coordinator] Wave 2: risk");
    const { output } = await callAgent("risk", taskDescription, (result.research ?? "").slice(0, 1500), agentMap.risk);
    result.riskAnalysis = output;
    if (agentMap.risk) {
      try { await assignAndPay(agentMap.risk, TASK_ID, result); } catch (err) {
        console.warn(`[Coordinator] assignAndPay risk failed (non-fatal): ${err}`);
      }
    }
  }

  // ── Wave 3: audit (depends on research + risk) ─────────────────────────────
  if (capabilities.includes("audit")) {
    console.log("[Coordinator] Wave 3: audit");
    const ctx = [result.research?.slice(0, 600), result.riskAnalysis?.slice(0, 600)]
      .filter(Boolean).join("\n\n");
    const { output } = await callAgent("audit", taskDescription, ctx, agentMap.audit);
    result.audit = output;
    if (agentMap.audit) {
      try { await assignAndPay(agentMap.audit, TASK_ID, result); } catch (err) {
        console.warn(`[Coordinator] assignAndPay audit failed (non-fatal): ${err}`);
      }
    }
  }

  // ── Wave 4: report (depends on all above) ──────────────────────────────────
  if (capabilities.includes("report")) {
    console.log("[Coordinator] Wave 4: report");
    const ctx = [result.research?.slice(0, 1000), result.riskAnalysis?.slice(0, 800), result.audit?.slice(0, 500)]
      .filter(Boolean).join("\n\n");
    const { output } = await callAgent("report", taskDescription, ctx, agentMap.report);
    result.report = output;
    if (agentMap.report) {
      try { await assignAndPay(agentMap.report, TASK_ID, result); } catch (err) {
        console.warn(`[Coordinator] assignAndPay report failed (non-fatal): ${err}`);
      }
    }
  }

  // ── Complete task on-chain — submitEvidence → verifyTask → completeTask ────
  if (onChain) {
    const resultHash = crypto.createHash("sha256").update(result.report).digest("hex");
    const hiredAgentRecords = capabilities
      .filter(c => agentMap[c])
      .map(c => agentMap[c]!);
    await completeTaskOnChain(TASK_ID, resultHash, hiredAgentRecords);
  }

  console.log("\n[Coordinator] ✅ Task complete!");
  console.log(`[Coordinator] Payment tx hashes: ${result.txHashes.join(", ")}`);
  console.log(`[Coordinator] On-chain: ${result.onChain}`);
  console.log("[Coordinator] Explorer links:");
  result.explorerLinks.forEach(l => console.log("  ", l));

  return result;
}
