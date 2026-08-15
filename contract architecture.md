# NORD-AI Smart Contract Architecture

## Overview

NORD-AI is a Quai-compatible Solidity protocol for coordinating autonomous AI-agent work. AI execution remains off-chain. The contracts provide the durable accountability layer: agent identity, capability discovery, task escrow, evidence commitments, settlement, and reputation history.

The contract workspace is Hardhat-based. Solidity sources live in `contracts/`, tests live in `test/`, deployment automation lives in `scripts/deploy.ts`, and compiler/network configuration lives in `hardhat.config.ts`.

## Contracts

| Contract | Responsibility |
| --- | --- |
| `AgentRegistry` | Canonical on-chain identity for agent wallets. Stores owner, metadata URI, declared capabilities, price, zone, and active status. |
| `AgentReputation` | Append-only outcome history and score accounting for agents. Only the configured coordinator can write reputation events. |
| `TaskCoordinator` | Main escrow and lifecycle contract. Creates funded tasks, routes/assigns agents, accepts evidence, verifies, settles, fails, disputes, resolves, and cancels tasks. |
| `ZoneRouter` | Maps capabilities to protocol zones and indexes active agents per capability/zone for discovery. |
| `CrossZoneSettlement` | MVP adapter for future cross-zone settlement flows. It records destination-zone settlement intent and can finalize or refund escrowed value. |
| `OwnableLite` | Minimal owner authorization primitive used for protocol administration. |
| `ReentrancyGuardLite` | Minimal reentrancy guard used around value-moving flows. |

## Module Relationships

```text
AgentRegistry ──────┐
                    ├── TaskCoordinator ─── AgentReputation
ZoneRouter ─────────┘

TaskCoordinator ─── CrossZoneSettlement
```

`TaskCoordinator` trusts `AgentRegistry` for agent eligibility and zone checks. `AgentReputation` trusts only `TaskCoordinator` to write outcomes. `ZoneRouter` reads `AgentRegistry` and maintains a discovery index.

## Task Lifecycle

```text
Created
  -> Routed
  -> Funded
  -> Assigned
  -> Executing
  -> EvidenceSubmitted
  -> Verified
  -> Settled
```

Alternative terminal paths:

- `Cancelled`: requester cancels before agent execution has evidence.
- `Failed`: requester fails an assigned/executing/evidence-submitted/verified task and receives a refund.
- `Disputed -> Resolved`: requester disputes evidence; resolution either refunds the requester or pays the agent.

## Settlement Model

Task budgets are paid into `TaskCoordinator` when a task is created or funded. Settlement uses checks-effects-interactions and low-level `call` after setting task budget to zero.

Successful completion pays the selected agent and records a success reputation event. Failure refunds the requester and records a failure event when an agent was assigned. Cancellation refunds without a reputation penalty because no terminal outcome has been established.

## Reputation Model

`AgentReputation` stores a per-agent score and append-only `ReputationEvent[]`.

- Success: `+successWeight`
- Failure: `-failureWeight`, floored at zero
- Dispute opened: event only, no score change
- Dispute resolved against agent: failure count and penalty
- Dispute resolved in favor of agent: completion count

Terminal outcomes are protected by `terminalRecorded[agent][taskId]` so a task cannot double-count success/failure/resolution reputation.

## Authorization

- Agent profile updates are controlled by the registered agent owner.
- Reputation writes are restricted to the configured coordinator.
- Task state changes are restricted by role:
  - requester creates, routes, assigns, verifies, completes, fails, disputes, resolves, and cancels
  - assigned agent accepts assignment and submits evidence
- Protocol settings such as reputation weights and router zone mappings are owner-controlled.
- Cross-zone finalization is owner-controlled until real ETX/SolidityX settlement is integrated.

## Hardhat Deployment

The Hardhat deploy script is `scripts/deploy.ts`. It deploys:

1. `AgentRegistry`
2. `AgentReputation`
3. `TaskCoordinator`
4. `ZoneRouter`
5. `CrossZoneSettlement`

After deployment it sets `AgentReputation`'s coordinator to `TaskCoordinator` and configures the default router capability mappings.

Local/default network deployment:

```bash
npm run deploy
```

Quai testnet deployment uses `hardhat.config.ts` and the `.env` values `QUAI_TESTNET_RPC_URL` and `QUAI_PRIVATE_KEY`:

```bash
npm run deploy -- --network quaiTestnet
```

## Verification

Primary checks:

```bash
npm run compile
npm test
```
