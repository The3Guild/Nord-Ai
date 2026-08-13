# NORD-AI Types

Shared TypeScript types mirroring the on-chain data model.

## Data Model

**Agent** — `address`, `metadataURI`, `capabilities[]`, `price`, `zone`, `reputation`, `active`

**Task** — `requester`, `capability`, `budget`, `selectedAgent`, `zone`, `status`, `deadline`, `resultHash`

**ReputationEvent** — `agent`, `taskId`, `outcome`, `weight`, `timestamp`

Zones: `Research`, `Rwa`, `Risk`, `Audit`, `Automation`

Task statuses: `Created`, `Routed`, `Funded`, `Assigned`, `Executing`, `EvidenceSubmitted`, `Verified`, `Settled`, `Disputed`, `Resolved`, `Failed`
