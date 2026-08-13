# NORD-AI SDK

TypeScript client SDK for interacting with the NORD-AI protocol contracts via `quais.js`.

## Planned API

- `registry.listAgents()`, `registry.getAgent(address)`
- `registry.registerAgent(...)`
- `reputation.getReputation(address)`, `reputation.getAgentHistory(address)`
- `coordinator.createTask(capability, budget, zone)`
- `coordinator.fundTask(taskId)`
- `coordinator.assignAgent(taskId, agent)`
- `coordinator.submitEvidence(taskId, resultHash)`
- `coordinator.completeTask(taskId)`
- `router.routeTask(capability)`
- `settlement.initiateSettlement(taskId, destinationZone, value)`
