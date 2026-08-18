import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { runCoordinator, findAllAgents, queryContractVar } from "./coordinator";
import { runAgent, type Capability } from "./agentRunner";
import { buildProject } from "./builder";
import { getReputation, getReputationEvents } from "./reputation";
import { getSettlements } from "./settlements";
import { getCoordinatorWallet, getProvider } from "./chain";
import { quais } from "quais";

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(",")
    : ["https://nord-ai.vercel.app", "http://localhost:3001", "http://localhost:3000"],
  methods: ["GET", "POST"],
}));
app.use(express.json());

const limiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", async (_req: Request, res: Response) => {
  let balance = "unknown";
  try {
    const wallet = getCoordinatorWallet();
    const addr = await wallet.getAddress();
    const bal = await getProvider().getBalance(addr);
    balance = quais.formatQuai(bal);
  } catch {}
  res.json({ status: "ok", chain: config.quaiNetworkName, network: "quai", balance });
});

/**
 * GET /agents
 * Returns all registered agents.
 * Includes tasksFailed and lastUpdated from local reputation cache.
 */
app.get("/agents", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = await findAllAgents();

    const enriched = await Promise.all(agents.map(async (agent) => {
      try {
        const rep = await getReputation(agent.accountHash, agent);
        if (!rep) {
          return {
            ...agent,
            reputationScore: null, tasksFailed: null, lastUpdated: null,
            userRating: agent.userRating ?? null, userRatingCount: agent.userRatingCount ?? 0,
          };
        }
        return {
          ...agent,
          reputationScore: rep.score,
          tasksFailed:     rep.tasksFailed,
          lastUpdated:     rep.lastUpdated,
          userRating:      agent.userRating ?? null,
          userRatingCount: agent.userRatingCount ?? 0,
        };
      } catch {
        return {
          ...agent,
          reputationScore: null, tasksFailed: null, lastUpdated: null,
          userRating: agent.userRating ?? null, userRatingCount: agent.userRatingCount ?? 0,
        };
      }
    }));

    res.json({ agents: enriched });
  } catch (err) { next(err); }
});

/**
 * GET /agents/:address/reputation
 * Returns reputation data for a specific agent.
 */
app.get("/agents/:address/reputation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const { getAllAgents } = await import("./agentStore");
    const allAgents = getAllAgents();
    const agentRecord = allAgents.find(a => a.accountHash === address) ?? null;
    const [rep, events] = await Promise.all([
      getReputation(address, agentRecord),
      getReputationEvents(address),
    ]);
    res.json({ reputation: rep, events });
  } catch (err) { next(err); }
});

/**
 * POST /agents/:address/rate
 * Submit a user rating (1–5 stars) for an agent.
 */
app.post("/agents/:address/rate", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const { rating } = req.body as { rating: number };

    if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be a number between 1 and 5" });
      return;
    }

    const { rateAgent } = await import("./agentStore");
    const result = rateAgent(address, rating);
    if (!result) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.json({
      address,
      userRating:      result.userRating,
      userRatingCount: result.userRatingCount,
    });
  } catch (err) { next(err); }
});

/**
 * GET /setup/check
 * Validates the backend configuration and returns any issues.
 */
app.get("/setup/check", async (_req: Request, res: Response) => {
  const issues: string[] = [];

  if (!config.coordinatorPrivateKey) {
    issues.push("COORDINATOR_PRIVATE_KEY is not set. Set it in your .env");
  }
  if (!config.veniceApiKey || config.veniceApiKey === "your-venice-api-key") {
    issues.push("VENICE_API_KEY is missing or still a placeholder");
  }

  let coordinatorAddress = "unknown";
  let balance = "unknown";
  try {
    const wallet = getCoordinatorWallet();
    coordinatorAddress = await wallet.getAddress();
    const bal = await getProvider().getBalance(coordinatorAddress);
    balance = quais.formatQuai(bal);
  } catch (e) {
    issues.push(`Cannot load coordinator wallet: ${(e as Error).message}`);
  }

  res.json({
    ok: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined,
    coordinatorAddress,
    balance,
    rpc: config.quaiRpcUrl,
    chain: config.quaiNetworkName,
    contracts: {
      agentRegistry: config.contracts.agentRegistry,
      agentReputation: config.contracts.agentReputation,
      taskCoordinator: config.contracts.taskCoordinator,
    },
  });
});

/**
 * GET /stats
 * Returns on-chain task count and agent count.
 */
app.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let chainReadOk = true;
    const [taskCount, agentCount] = await Promise.all([
      queryContractVar("taskCount")
        .then(v => v !== undefined ? Number(v) : (chainReadOk = false, 0))
        .catch(() => { chainReadOk = false; return 0; }),
      findAllAgents().then(a => a.length),
    ]);
    res.json({ taskCount, agentCount, chainReadOk });
  } catch (err) { next(err); }
});

/**
 * POST /task
 * Full coordinator loop: discover all agents → assign → Venice AI → complete
 */
const designStore = new Map<string, string>();

app.post("/task", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, capabilities } = req.body as {
      description: string;
      capabilities?: string[];
    };
    if (!description?.trim()) { res.status(400).json({ error: "description is required" }); return; }

    const result = await runCoordinator(description, capabilities);

    if (result.design) designStore.set(result.taskId.toString(), result.design);

    res.json({
      taskId:          result.taskId,
      agentsHired:     result.agentsHired,
      txHashes:        result.txHashes,
      explorerLinks:   result.explorerLinks,
      onChain:         result.onChain,
      research:        result.research,
      riskAnalysis:    result.riskAnalysis,
      coding:          result.coding,
      design:          result.design,
      audit:           result.audit,
      report:          result.report,
    });
  } catch (err) { next(err); }
});

// Serve design HTML as a live preview page
app.get("/design-preview/:taskId", (req: Request, res: Response) => {
  const html = designStore.get(req.params.taskId);
  if (!html) { res.status(404).send("Design not found"); return; }
  const full = html.trim().startsWith("<!DOCTYPE") || html.trim().startsWith("<html")
    ? html
    : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design Preview</title></head><body>${html}</body></html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(full);
});

/**
 * POST /agent/register
 * Register an agent on-chain via the coordinator wallet.
 * Body: { address, endpoint, capability, price }
 */
app.post("/agent/register", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, endpoint, capability, price } = req.body as {
      address: string;
      endpoint: string;
      capability: string;
      price?: string;
    };

    if (!address?.trim()) { res.status(400).json({ error: "address is required" }); return; }
    if (!endpoint?.trim()) { res.status(400).json({ error: "endpoint is required" }); return; }
    if (!capability?.trim()) { res.status(400).json({ error: "capability is required" }); return; }

    const priceWei = price
      ? quais.parseQuai(price)
      : quais.parseQuai("0.0005");

    const wallet = getCoordinatorWallet();
    const agentRegistry = new quais.Contract(
      config.contracts.agentRegistry,
      [
        "function registerAgent(address _agent, string _metadataURI, string[] _capabilities, uint256 _price, uint256 _zone)",
      ],
      wallet,
    );

    const zoneMap: Record<string, number> = {
      research: 0, rwa: 1, risk: 2, audit: 3, coding: 4, design: 4, report: 3,
    };
    const zoneIndex = zoneMap[capability] ?? 0;

    const tx = await agentRegistry.registerAgent(
      address,
      endpoint,
      [capability],
      priceWei,
      zoneIndex,
    );
    const receipt = await tx.wait();

    // Store locally
    const { addAgent } = await import("./agentStore");
    addAgent(address, endpoint, capability, priceWei.toString(), "on-chain");

    res.json({
      success: true,
      txHash: receipt?.hash,
      explorerUrl: `${config.quaiscanBaseUrl}/tx/${receipt?.hash}`,
      message: "Agent registered on-chain.",
    });
  } catch (err) { next(err); }
});

/**
 * POST /agent/deactivate
 * Deactivate an agent on-chain.
 */
app.post("/agent/deactivate", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body as { address: string };
    if (!address?.trim()) { res.status(400).json({ error: "address is required" }); return; }

    const wallet = getCoordinatorWallet();
    const agentRegistry = new quais.Contract(
      config.contracts.agentRegistry,
      ["function deactivate(address _agent)"],
      wallet,
    );

    const tx = await agentRegistry.deactivate(address);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: receipt?.hash,
      explorerUrl: `${config.quaiscanBaseUrl}/tx/${receipt?.hash}`,
    });
  } catch (err) { next(err); }
});

/**
 * POST /agent/:capability/run
 * Run a single agent for inference via Venice AI.
 */
app.post("/agent/:capability/run", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const capability = req.params.capability as Capability;
    const { taskId, description, context = "" } = req.body as {
      taskId: string; description: string; context?: string;
    };

    if (!["research","risk","report","coding","design","audit"].includes(capability)) {
      res.status(400).json({ error: `Unknown capability: ${capability}` }); return;
    }
    if (!taskId || !description?.trim()) {
      res.status(400).json({ error: "taskId and description are required" }); return;
    }

    const result = await runAgent(capability, BigInt(taskId), description, context);
    res.json({
      capability:     result.capability,
      agentAddress:   result.agentAddress,
      output:         result.output,
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/agents/run
 * Real A2A agent execution endpoint.
 */
app.post("/api/agents/run", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId, capability, description, context = "" } = req.body as {
      taskId: string;
      capability: string;
      description: string;
      context?: string;
    };

    if (!["research","risk","report","coding","design","audit"].includes(capability)) {
      res.status(400).json({ error: `Unknown capability: ${capability}` }); return;
    }
    if (!description?.trim()) {
      res.status(400).json({ error: "description is required" }); return;
    }

    const { runAgent: execAgent } = await import("./agentRunner");
    const result = await execAgent(capability as Capability, BigInt(taskId ?? "0"), description, context);

    res.json({
      output:     result.output,
      capability: result.capability,
      agentAddress: result.agentAddress,
    });
  } catch (err) { next(err); }
});

/**
 * POST /verify-endpoint
 * Probes an agent endpoint to confirm it's reachable.
 */
app.post("/verify-endpoint", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body as { endpoint: string };
    if (!endpoint?.trim()) { res.status(400).json({ error: "endpoint is required" }); return; }

    let url: URL;
    try { url = new URL(endpoint); } catch { res.status(400).json({ ok: false, reason: "Invalid URL" }); return; }
    if (!["http:", "https:"].includes(url.protocol)) {
      res.status(400).json({ ok: false, reason: "URL must be http or https" }); return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const probe = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "ping", description: "NORD-AI endpoint verification" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!probe.ok) {
        res.json({ ok: false, reason: `Endpoint returned HTTP ${probe.status}` }); return;
      }
      const text = await probe.text().catch(() => "");
      res.json({ ok: true, status: probe.status, preview: text.slice(0, 200) });
    } catch (e: unknown) {
      clearTimeout(timeout);
      const msg = (e as Error).message ?? "Connection failed";
      res.json({ ok: false, reason: msg.includes("abort") ? "Endpoint timed out (>10s)" : msg });
    }
  } catch (err) { next(err); }
});

/**
 * POST /suggest-agents
 * Deterministic routing — matches task keywords to capabilities.
 */
app.post("/suggest-agents", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description = "" } = req.body as { description: string };
    const d = description.toLowerCase();

    let registeredCaps: string[] = [];
    try {
      const { getAllAgents } = await import("./agentStore");
      const agents = getAllAgents();
      const caps = new Set(agents.map(a => a.capability).filter(Boolean));
      registeredCaps = [...caps];
    } catch { registeredCaps = ["research","risk","coding","design","audit","report"]; }

    const hasCoding  = /\b(build|code|implement|write|create|develop|program|script|solidity|smart contract|dapp|app|cli|api|backend|frontend|website|web app|react|next|vue|angular|node|express)\b/.test(d);
    const hasDesign  = /\b(design|ui|ux|interface|layout|figma|wireframe|visual|landing page|dashboard|component|style|theme|css|tailwind)\b/.test(d);
    const hasBiz     = /\b(market|research|analysis|strategy|business|competitor|risk|report|study|survey|industry|trend|startup|investment|growth)\b/.test(d);
    const hasMixed   = hasCoding && hasBiz;

    let base: string[];
    if (hasMixed)        base = hasDesign ? ["research","coding","design","audit","report"] : ["research","coding","audit","report"];
    else if (hasCoding)  base = hasDesign ? ["coding","design","report"] : ["coding","report"];
    else if (hasDesign)  base = ["design","report"];
    else                 base = ["research","risk","audit","report"];

    const customCaps = registeredCaps.filter(cap =>
      !base.includes(cap) &&
      !["research","risk","coding","design","audit","report"].includes(cap) &&
      d.includes(cap.toLowerCase())
    );
    const reportIdx = base.indexOf("report");
    const capabilities = reportIdx >= 0
      ? [...base.slice(0, reportIdx), ...customCaps, ...base.slice(reportIdx)]
      : [...base, ...customCaps];

    const filtered = capabilities.filter(c => registeredCaps.includes(c));
    if (!filtered.includes("report") && registeredCaps.includes("report")) filtered.push("report");

    res.json({ capabilities: filtered.length > 0 ? filtered : base });
  } catch (err) { next(err); }
});

/**
 * POST /enhance
 * Refine a specific agent output with a follow-up prompt.
 */
app.post("/enhance", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { capability, originalOutput, feedback } = req.body as {
      capability: string; originalOutput: string; feedback: string;
    };
    if (!originalOutput?.trim() || !feedback?.trim()) {
      res.status(400).json({ error: "originalOutput and feedback are required" }); return;
    }
    const { veniceChat } = await import("./agents/venice.js");
    const SYSTEM = `You are a ${capability} specialist. You previously produced an output. The user wants it improved. Apply their feedback precisely and return the complete revised output — no explanations, just the improved content.`;
    const enhanced = await veniceChat(SYSTEM, `Original output:\n${originalOutput}\n\nUser feedback:\n${feedback}\n\nRevised output:`, "mistral-small-3-2-24b-instruct");
    res.json({ enhanced });
  } catch (err) { next(err); }
});

app.post("/build", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body as { prompt: string };
    if (!prompt?.trim()) { res.status(400).json({ error: "prompt is required" }); return; }
    const result = await buildProject(prompt);
    const htmlFile = result.files.find(f => f.path.endsWith(".html") && (f.content.includes("<!DOCTYPE") || f.content.includes("<html")));
    res.json({
      success:    result.success,
      outputDir:  result.outputDir,
      previewUrl: result.previewUrl,
      plan:       result.plan,
      html:       htmlFile?.content,
      files:      result.files.map(f => ({ path: f.path, size: f.content.length })),
      buildLog:   result.buildLog.slice(-2000),
    });
  } catch (err) { next(err); }
});

/**
 * GET /settlements
 * Returns all persisted settlement records.
 */
app.get("/settlements", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settlements = getSettlements();
    res.json({ settlements, count: settlements.length });
  } catch (err) { next(err); }
});

/**
 * POST /payment
 * Initiate a direct QUAI payment from coordinator to an agent.
 * Body: { to, amount, label? }
 */
app.post("/payment", limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, amount, label } = req.body as { to: string; amount: string; label?: string };
    if (!to?.trim()) { res.status(400).json({ error: "to address is required" }); return; }
    if (!amount?.trim()) { res.status(400).json({ error: "amount (in QUAI) is required" }); return; }

    const { settlePayment } = await import("./x402");
    const result = await settlePayment(to, amount, label);

    const { addSettlement } = await import("./settlements");
    addSettlement({
      hash:       result.hash,
      from:       result.from,
      to:         result.to,
      amount:     result.amount,
      capability: label ?? "direct",
      taskId:     "user-initiated",
    });

    res.json({
      success: true,
      txHash: result.hash,
      explorerUrl: `${config.quaiscanBaseUrl}/tx/${result.hash}`,
      from: result.from,
      to: result.to,
      amount,
    });
  } catch (err) { next(err); }
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const stackLines = err.stack?.split("\n").slice(1, 3).join("\n");
  console.error("[Server error]", err.message, stackLines || "");
  res.status(500).json({ error: err.message });
});

app.listen(config.port, async () => {
  console.log(`[NORD-AI] Backend running on port ${config.port}`);
  console.log(`[NORD-AI] Network: ${config.quaiNetworkName}`);
  console.log(`[NORD-AI] RPC: ${config.quaiRpcUrl}`);
  console.log(`[NORD-AI] TaskCoordinator: ${config.contracts.taskCoordinator}`);

  try {
    const wallet = getCoordinatorWallet();
    const addr = await wallet.getAddress();
    const bal = await getProvider().getBalance(addr);
    console.log(`[NORD-AI] Coordinator: ${addr} (${quais.formatQuai(bal)} QUAI)`);
  } catch (e) {
    console.warn(`[NORD-AI] Could not load coordinator wallet: ${e}`);
  }

  try {
    const { seedCoordinatorAgents } = await import("./agentStore");
    await seedCoordinatorAgents();
  } catch (err) {
    console.warn(`[NORD-AI] Agent seeding failed (non-fatal): ${err}`);
  }
});
