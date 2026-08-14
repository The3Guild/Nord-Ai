// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/AgentRegistry.sol";
import "../contracts/AgentReputation.sol";
import "../contracts/TaskCoordinator.sol";
import "../contracts/ZoneRouter.sol";
import "../contracts/CrossZoneSettlement.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployNordAi {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Deployment {
        AgentRegistry registry;
        AgentReputation reputation;
        TaskCoordinator coordinator;
        ZoneRouter router;
        CrossZoneSettlement settlement;
    }

    function run() external returns (Deployment memory deployment) {
        vm.startBroadcast();

        deployment.registry = new AgentRegistry();
        deployment.reputation = new AgentReputation();
        deployment.coordinator = new TaskCoordinator(
            address(deployment.registry),
            address(deployment.reputation)
        );
        deployment.reputation.setCoordinator(address(deployment.coordinator));

        deployment.router = new ZoneRouter(address(deployment.registry));
        deployment.router.setZoneForCapability("web-research", AgentRegistry.Zone.Research);
        deployment.router.setZoneForCapability("rwa-research", AgentRegistry.Zone.Rwa);
        deployment.router.setZoneForCapability("risk-analysis", AgentRegistry.Zone.Risk);
        deployment.router.setZoneForCapability("audit", AgentRegistry.Zone.Audit);
        deployment.router.setZoneForCapability("automation", AgentRegistry.Zone.Automation);

        deployment.settlement = new CrossZoneSettlement(address(deployment.coordinator));

        vm.stopBroadcast();
    }
}
