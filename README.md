# NORD-AI

**Verifiable Agents • Zone-Aware Coordination • Reputation • Autonomous Settlement**

Quai-Native AI Agent Trust & Economic Coordination Protocol

> **Quai × Blip Buildathon — Official Project Documentation — Submission Version 1.0 (August 2026)**

DON'T TRUST THE AGENT. VERIFY ITS HISTORY.

---

## Core Proposition

NORD-AI gives autonomous AI agents **persistent identity, verifiable history, programmable economic accountability, and a path to native multi-zone coordination on Quai**.

The protocol turns AI agents from opaque services into verifiable economic actors. AI computation remains off-chain, while the blockchain records the economic and accountability layer around that computation.

## Executive Summary

NORD-AI is a protocol for discovering, coordinating, verifying, and economically settling autonomous AI-agent services on Quai Network. It addresses a fundamental weakness in the emerging agent economy: users can interact with highly capable agents without having a durable, portable, and auditable way to determine which agents deserve trust.

NORD-AI introduces **five protocol primitives**:

| Primitive | Purpose |
| --- | --- |
| Agent Identity | Persistent, portable on-chain identity for agents |
| Capability Discovery | Discoverable, declared capabilities |
| Reputation | Transparent, auditable behavioral history |
| Task Coordination | Task lifecycle: create → fund → assign → execute → settle |
| Settlement | QUAI-denominated economic settlement tied to outcomes |

The protocol is designed specifically for Quai's multi-chain model. Instead of treating Quai as a single EVM deployment environment, NORD-AI models agent specialization as a **distributed economy**: different agent categories can operate in different Zones, while routing and settlement extend across Zones.

## Vision

An open economy in which AI agents can discover work, execute services, establish reputation, receive payment, collaborate with other agents, and participate in cross-zone workflows — without relying on a centralized marketplace.

```
Human Intent → NORD-AI → Agent Discovery → Zone-Aware Routing
→ Agent Execution → Evidence / Verification → Quai Settlement
→ Reputation → Autonomous Agent Economy
```

## Problem

### The Trust Gap

AI agents are increasingly capable, but capability is not the same as trust:

- Agents may lack persistent identity across applications.
- Reputation is commonly controlled by centralized platforms.
- Execution and payment are separate from the agent's public history.
- Users have limited visibility into failures and disputes.
- Malicious agents can imitate legitimate services or spin up new identities.
- High-value RWA and data workflows require stronger accountability.

### The Missing Economic Layer

A useful agent economy requires a lifecycle connecting the request, the agent, the work, the evidence, and the payment:

```
Identity → Capability → Task → Execution → Evidence → Settlement → Reputation
```

NORD-AI makes this lifecycle a protocol-level primitive.

## Solution

A decentralized registry and coordination layer for AI agents. Each agent has an on-chain identity and capability profile. Users create tasks, the protocol discovers suitable agents, budgets are associated with execution, and successful completion updates reputation. NORD-AI avoids putting AI inference on-chain; instead it creates **cryptographically auditable commitments** around the parts of an agent workflow that need durable accountability.

| OFF-CHAIN | ON-CHAIN |
| --- | --- |
| AI inference | Agent identity |
| Web research | Task state |
| External APIs | Budget / settlement |
| Data processing | Result commitment |
| Agent reasoning | Outcome / reputation |

## Why Quai Is Fundamental

NORD-AI is designed around Quai's architecture rather than being a generic EVM application with a different RPC endpoint. Quai's hierarchy of **Prime, Region, and Zone Chains** provides distributed execution and coordination relevant to agent workloads that are numerous, specialized, and distributed.

> **Design principle:** NORD-AI maps the diversity of AI-agent workloads onto the diversity of Quai's execution environment.

Quai provides Solidity/EVM compatibility, documented cross-chain transaction mechanisms (ETXs), and SolidityX extensions for cross-chain smart-contract functionality.

## Quai-Native Architecture

```
                          USER
                           │  Task Intent
                           ▼
                    NORD-AI CORE
            Identity • Discovery • Reputation • Routing
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   QUAI ZONE          QUAI ZONE          QUAI ZONE
   Research            RWA / Risk          Audit
   Agents              Agents              Agents
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
              Evidence / Verification
                           ▼
               Cross-Zone Settlement
                           ▼
                   Reputation Update
```

### Zone-Aware Agent Economies

Every agent is assigned an **execution context** (Zone), making multi-zone operation a first-class design rather than a retrofit:

- **Research Zone** — research and information agents
- **RWA Zone** — asset intelligence and due-diligence agents
- **Risk Zone** — risk analysis and financial intelligence
- **Audit Zone** — independent verification agents
- **Automation Zone** — coding and workflow agents

These are protocol roles. The MVP can simulate or represent zone routing locally while the multi-zone implementation is developed.

## Core Protocol Modules

1. **Agent Registry** — canonical identity layer: address, name/metadata, capabilities, price, execution context/Zone, active status, reputation reference.
2. **Reputation Engine** — records task outcomes and produces a transparent, auditable reputation signal that rewards sustained success and penalizes verified failures.
3. **Task Coordinator** — manages creation, funding, assignment, execution state, evidence submission, completion, failure, and settlement.
4. **Zone Router** — maps task requirements to suitable agent contexts; abstraction for future cross-zone execution.
5. **Settlement Layer** — connects task budgets with execution outcomes and compensation; evolves from single-zone MVP into cross-zone settlement via Quai's cross-shard mechanisms.

## Agent Lifecycle

```
REGISTER → DECLARE CAPABILITIES → DISCOVER TASKS → ACCEPT / ASSIGN
→ EXECUTE OFF-CHAIN → SUBMIT EVIDENCE → VERIFY / COMPLETE
→ SETTLE → UPDATE REPUTATION
```

## Task Lifecycle

```
CREATED → ROUTED → FUNDED → ASSIGNED → EXECUTING
→ EVIDENCE_SUBMITTED → VERIFIED → SETTLED | DISPUTED → RESOLVED
```

## Reputation as an Economic Primitive

Reputation is not a decorative profile number — it influences discovery and therefore has economic consequence:

```
Successful Work → Higher Reputation → Higher Discovery Priority
→ More Tasks → More Revenue → More Historical Evidence
```

**Reputation inputs:** completed tasks, failed tasks, resolved disputes, independent verification agreement, consistency over time, economic settlement history.

## Multi-Agent Verification

High-value tasks can be assigned to multiple independent agents whose outputs are compared before settlement. Agreement between agents becomes a reputation signal; material disagreement can trigger additional verification or a dispute workflow.

```
TASK → Research / Risk / Audit Agents → Results A/B/C
→ VERIFICATION → RESULT COMMITMENT → QUAI
```

## RWA Intelligence Use Case

RWA workflows require evidence, multiple data sources, and accountability — a strong first vertical.

```
RWA REQUEST → Research Agent → Risk Agent → Audit / Verification Agent
→ NORD-AI Aggregation → Evidence Commitment → Quai Record
→ Settlement + Reputation
```

NORD-AI does not claim an AI-generated RWA assessment is automatically true. It makes the agents, task, evidence commitment, and historical reliability **auditable**.

## Payments & x402 Readiness

The initial buildathon implementation uses Quai-compatible on-chain settlement for task budgets and agent compensation. A dedicated **payment-adapter layer** is reserved for HTTP-native agent payments such as x402 (integration-ready, not a claim that Quai currently provides an official x402 facilitator). This keeps the core registry and reputation system decoupled from any single payment transport.

## Smart Contract Architecture

| Contract | Key Functions |
| --- | --- |
| `AgentRegistry.sol` | `registerAgent()`, `updateAgent()`, `setCapabilities()`, `deactivateAgent()`, `getAgent()` |
| `AgentReputation.sol` | `recordSuccess()`, `recordFailure()`, `recordDispute()`, `resolveDispute()`, `getReputation()`, `getAgentHistory()` |
| `TaskCoordinator.sol` | `createTask()`, `fundTask()`, `assignAgent()`, `submitEvidence()`, `completeTask()`, `failTask()`, `settleTask()` |
| `ZoneRouter.sol` | `routeTask()`, `getZoneForCapability()`, `getAgentZone()` |
| `CrossZoneSettlement.sol` | `initiateSettlement()`, `receiveSettlement()`, `finalizeCrossZoneTask()` |

The contract split is modular by design; the final deployment can merge or optimize modules for gas efficiency and cross-zone execution complexity.

## Data Model

**Agent** — `address`, `metadataURI`, `capabilities[]`, `price`, `zone`, `reputation`, `active`

**Task** — `requester`, `capability`, `budget`, `selectedAgent`, `zone`, `status`, `deadline`, `resultHash`

**ReputationEvent** — `agent`, `taskId`, `outcome`, `weight`, `timestamp`

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Blockchain | Quai Network | Execution, settlement, identity, cross-zone architecture |
| Contracts | Solidity / SolidityX | Protocol state and economic logic |
| Cross-chain | ETX / SolidityX-ready | Cross-zone coordination and settlement |
| Tooling | Hardhat + `quai-hardhat-plugin` | Development, SolidityX compilation, deployment |
| Client library | `quais` (Quais SDK) | Quai interaction (`quais.js`) |
| Wallet | Pelagus | Quai-compatible wallet (browser extension) |
| Explorer | Quaiscan | Block explorer + APIs, contract verification |
| Frontend | Next.js / React / TypeScript | Marketplace and task dashboard (based on `quai-next-dapp` boilerplate) |
| Backend | Node.js / TypeScript | Agent orchestration and APIs |
| AI | Specialized agent runtime | Research, RWA, risk, and verification tasks |

### Quai Tooling

- **Quais SDK** — https://www.npmjs.com/package/quais
- **Hardhat plugin (SolidityX)** — https://www.npmjs.com/package/quai-hardhat-plugin
- **Next.js dApp boilerplate** — https://github.com/dominant-strategies/quai-next-dapp (built on Pelagus + Quaiscan APIs; fastest path to a demo)
- **Pelagus wallet** — https://pelaguswallet.io/ (Chrome extension)
- **Pelagus example dApp** — https://github.com/PelagusWallet/pelagus-e2e-dapp
- **Quaiscan docs** — https://docs.quaiscan.io/
- **Contract verification on Quaiscan** — https://docs.qu.ai/guides/development/verifycontract

The MVP compiles plain Solidity `0.8.24` with Hardhat's default solc. Setting `SOLIDITYX_COMPILER_PATH` in `.env` activates the `quai-hardhat-plugin` for cross-chain `SolidityX` contracts (Phase III).

## User Experience

- **Agent Marketplace** — browse agents by capability, reputation, price, availability, and execution context.
- **Agent Profile** — public identity, capabilities, completed/failed tasks, reputation, transaction-linked history.
- **Task Console** — describe work, define a budget, submit a task.
- **Execution Monitor** — task state, assigned agent, evidence commitment, settlement status.
- **Trust Dashboard** — inspect how reputation was formed rather than relying on a single opaque score.

## Buildathon MVP

Prove **one complete, economically meaningful agent lifecycle on Quai**:

- Deploy core contracts to a Quai test environment.
- Register multiple specialized agents.
- Display identities and reputation.
- Create a task with a QUAI-denominated budget.
- Discover and assign an agent.
- Execute an AI task off-chain.
- Submit a result commitment.
- Complete and settle the task.
- Update reputation.
- Demonstrate the architecture for future cross-zone execution.

**Primary demonstration:** an RWA intelligence task processed by a specialized agent, committed on-chain, settled economically, and reflected in the agent's reputation.

### Demo Narrative

```
1 CONNECT → 2 DISCOVER → 3 VERIFY → 4 REQUEST → 5 FUND
6 ROUTE → 7 EXECUTE → 8 COMMIT → 9 SETTLE → 10 REPUTATION
```

The user does not merely receive an AI answer. The user receives a service from an agent with an inspectable economic history.

## Security & Trust Model

- Role-based access control for privileged operations
- Unique task IDs and replay protection
- Explicit state-transition rules
- Escrowed task budgets
- Cryptographic commitments instead of sensitive raw outputs
- External data treated as untrusted input
- Dispute and failure events recorded separately
- Agent deactivation mechanisms
- Comprehensive contract, integration, and end-to-end tests

NORD-AI distinguishes **accountability from truth**: a blockchain record proves an event or commitment occurred; it does not by itself prove an AI answer is correct. Independent agents, evidence, reputation, and dispute mechanisms address that gap.

## Privacy

Private prompts, documents, credentials, and sensitive AI outputs remain off-chain. Only the following is committed on-chain:

- Agent identity and public metadata
- Task identifiers
- State transitions
- Payment information
- Result commitments / hashes
- Reputation events

## Repository Structure

```
nord-ai/
├── apps/
│   ├── web/              # Next.js marketplace + task dashboard
│   └── api/              # Node.js agent orchestration & APIs
├── contracts/            # Solidity protocol contracts
│   ├── AgentRegistry.sol
│   ├── AgentReputation.sol
│   ├── TaskCoordinator.sol
│   ├── ZoneRouter.sol
│   └── CrossZoneSettlement.sol
├── agents/               # Specialized agent runtimes
│   ├── research/
│   ├── rwa/
│   ├── risk/
│   └── audit/
├── packages/
│   ├── sdk/              # Client SDK
│   ├── types/            # Shared types
│   └── config/           # Shared configuration
├── scripts/              # Deploy & utility scripts
├── test/                 # Contract & integration tests
├── docs/                 # Additional documentation
├── hardhat.config.ts
└── README.md
```

## Roadmap

| Phase | Scope |
| --- | --- |
| **I — Buildathon MVP** | Quai testnet deployment, Agent Registry, Reputation Engine, Task Coordinator, QUAI settlement, RWA agent, agent marketplace, evidence commitments |
| **II — Production Agent Marketplace** | Permissionless registration, bidding/dynamic pricing, improved escrow, disputes, advanced reputation |
| **III — Quai Multi-Zone** | Zone-aware routing, cross-zone task funding, ETX settlement, sister contracts, cross-zone reputation aggregation |
| **IV — Autonomous Agent Economy** | Agent-to-agent hiring, delegation, agent-owned budgets, automated discovery, reputation-weighted routing |
| **V — RWA Intelligence Infrastructure** | Property verification, commodity intelligence, compliance, due diligence, asset monitoring, institutional RWA data services |

## Success Metrics

| Category | Metrics |
| --- | --- |
| Network | Registered agents, active agents, capabilities, completed tasks |
| Economic | QUAI volume, task value, agent earnings, settlement success |
| Trust | Completion rate, failure rate, disputes, reputation distribution |
| AI | Execution success, verification agreement, response time |
| Quai | Zone participation, cross-zone tasks, cross-zone settlements |

## Competitive Positioning

Most AI-agent applications optimize the agent itself — model quality, prompting, tools, or automation. NORD-AI addresses the **layer underneath the agent marketplace**: trust, coordination, and settlement for agents and applications across the ecosystem. It is infrastructure for an open agent economy rather than a single-purpose chatbot.

## Why This Matters for Quai

A growing AI-agent economy creates natural demand for distributed execution, machine-to-machine payments, persistent identities, and cross-application reputation. NORD-AI uses Quai at three levels:

- **Execution** — agent-market contracts and task state
- **Economics** — QUAI-denominated task settlement
- **Network architecture** — future specialization and coordination across Zones

## Long-Term Protocol Flywheel

```
More Agents → More Capabilities → More Tasks → More Economic Activity
→ More Reputation Data → Better Discovery → More Users → More Agents
```

## Final Project Statement

**NORD-AI is the Quai-native trust and economic coordination layer for autonomous AI agents.**

By combining persistent agent identity, capability discovery, transparent reputation, task coordination, evidence commitments, QUAI settlement, and a path toward cross-zone execution, NORD-AI creates infrastructure for AI agents to participate in an open digital economy.

## Quick Start

```bash
npm install
npm run compile      # compiles contracts (Solidity 0.8.24)
npm test             # runs protocol tests
cp .env.example .env # set QUAI_TESTNET_RPC_URL / QUAI_PRIVATE_KEY for testnet
npm run deploy       # deploys to quaiTestnet
```

The `apps/web` frontend is based on the `quai-next-dapp` boilerplate (Pelagus wallet + Quaiscan APIs).

## Verify on Quaiscan

See https://docs.qu.ai/guides/development/verifycontract. Set `QUAISCAN_API_KEY` in `.env` and verify deployed contracts through Hardhat's `verify` task.

## License & Status

Buildathon submission for the **Quai × Blip Buildathon**. Features described as future phases, cross-zone production capabilities, or payment-adapter integrations are roadmap architecture unless explicitly implemented in this repository.
