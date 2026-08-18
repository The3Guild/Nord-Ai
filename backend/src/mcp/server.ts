import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const origErr = console.error;
console.log   = (...args: any[]) => origErr("[MCP]", ...args);
console.warn  = (...args: any[]) => origErr("[MCP]", ...args);
console.error = (...args: any[]) => origErr("[MCP]", ...args);

const BACKEND_URL = process.env.NORD_BACKEND_URL || "http://localhost:3000";

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  return res.json();
}

const server = new McpServer({
  name: "nord-ai",
  version: "0.2.0",
});

server.tool(
  "list_agents",
  "List all registered AI agents on Quai Network with reputation scores",
  {},
  async () => {
    const data = await api("/agents");
    const agents = (data.agents ?? []).map((a: any) => {
      const rep = a.reputationScore != null ? `rep:${a.reputationScore}` : "rep:—";
      const tasks = a.tasksCompleted != null ? `${a.tasksCompleted} tasks` : "";
      const price = a.pricePerTask ? `${(Number(a.pricePerTask) / 1e18).toFixed(4)} QUAI` : "";
      const flags = [a.demo ? "demo" : "", a.source === "on-chain" ? "on-chain" : ""].filter(Boolean).join(", ");
      return `[${a.capability}] ${a.accountHash?.slice(0, 14)}… — ${rep} ${tasks} ${price}${flags ? ` (${flags})` : ""}`;
    });
    return {
      content: [{
        type: "text" as const,
        text: agents.length > 0 ? agents.join("\n") : "No agents registered.",
      }],
    };
  },
);

server.tool(
  "get_agent_reputation",
  "Get reputation data for a specific agent (score, completions, failures, events)",
  {
    address: z.string().describe("Agent Quai address (0x + 40 hex)"),
  },
  async ({ address }) => {
    const data = await api(`/agents/${address}/reputation`);
    const rep = data.reputation;
    if (!rep) {
      return {
        content: [{
          type: "text" as const,
          text: `No reputation data for ${address.slice(0, 14)}…`,
        }],
      };
    }
    const events = (data.events ?? [])
      .map((e: any) => `  Task #${e.taskId} — ${e.completed ? "completed" : "failed"} (score: ${e.score}) at ${e.timestamp}`)
      .join("\n");
    return {
      content: [{
        type: "text" as const,
        text: [
          `Agent: ${address.slice(0, 14)}…`,
          `Score: ${rep.score}/10000`,
          `Completed: ${rep.tasksCompleted}`,
          `Failed: ${rep.tasksFailed}`,
          `Last updated: ${rep.lastUpdated}`,
          "",
          events ? `Events (${data.events.length}):\n${events}` : "No reputation events yet.",
        ].join("\n"),
      }],
    };
  },
);

server.tool(
  "suggest_agents",
  "Suggest which agents/capabilities to use for a task based on its description",
  {
    description: z.string().describe("Plain-English description of the work"),
  },
  async ({ description }) => {
    const data = await api("/suggest-agents", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    const caps = data.capabilities ?? [];
    return {
      content: [{
        type: "text" as const,
        text: caps.length > 0
          ? `Suggested capabilities: ${caps.join(", ")}`
          : data.error ?? "No suggestion available.",
      }],
    };
  },
);

server.tool(
  "dispatch_task",
  "Dispatch a task to the NORD-AI coordinator. Agents auto-select, run Venice AI inference, settle QUAI payments, and return results.",
  {
    description: z.string().describe("Plain-English task description"),
  },
  async ({ description }) => {
    const data = await api("/task", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    if (data.error) {
      return { content: [{ type: "text" as const, text: `Error: ${data.error}` }] };
    }
    const taskId = data.taskId ?? "unknown";
    const onChain = data.onChain ? "on-chain" : "local";
    const hired = (data.agentsHired ?? []).length;
    const txHashes = (data.txHashes ?? []);
    const links = (data.explorerLinks ?? []);
    return {
      content: [{
        type: "text" as const,
        text: [
          `Task #${taskId} completed (${onChain})`,
          `Agents hired: ${hired}`,
          txHashes.length > 0 ? `Payments: ${txHashes.length}` : "",
          links.length > 0 ? `Explorer links:\n${links.map((l: string) => `  ${l}`).join("\n")}` : "",
          "",
          data.report ? `Report:\n${data.report.slice(0, 1000)}` : "",
        ].filter(Boolean).join("\n"),
      }],
    };
  },
);

server.tool(
  "get_task_status",
  "Get the current task count and stats from the chain",
  {},
  async () => {
    const data = await api("/stats");
    return {
      content: [{
        type: "text" as const,
        text: [
          `Task count: ${data.taskCount ?? "unknown"}`,
          `Agent count: ${data.agentCount ?? "unknown"}`,
          `Chain read OK: ${data.chainReadOk ? "yes" : "no (local cache)"}`,
        ].join("\n"),
      }],
    };
  },
);

server.tool(
  "read_payment_history",
  "List settlement records — real Quai Network payment proofs",
  {
    agent: z.string().optional().describe("Filter by agent address"),
    limit: z.number().optional().describe("Max records to return"),
  },
  async ({ agent, limit }) => {
    const data = await api("/settlements");
    let settlements = data.settlements ?? [];
    if (agent) settlements = settlements.filter((s: any) => s.to === agent || s.from === agent);
    if (limit) settlements = settlements.slice(-limit);
    const rows = settlements.map((s: any) => {
      const amountQUAI = (Number(s.amount || "0") / 1e18).toFixed(4);
      const ts = s.timestamp ? new Date(s.timestamp).toLocaleDateString() : "—";
      return `${amountQUAI} QUAI  ${s.from?.slice(0, 12)}→${s.to?.slice(0, 12)}  ${s.hash?.slice(0, 16)}…  ${ts}`;
    });
    return {
      content: [{
        type: "text" as const,
        text: rows.length > 0 ? rows.join("\n") : "No settlements found.",
      }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  origErr("NORD-AI MCP server v0.2.0 running on stdio");
}

main().catch(e => { origErr(e); process.exit(1); });
