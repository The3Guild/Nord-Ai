// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";

contract ZoneRouter {
    struct Route {
        address agent;
        AgentRegistry.Zone zone;
    }

    mapping(bytes32 => AgentRegistry.Zone) private capabilityZone;
    mapping(address => AgentRegistry.Zone) private agentZone;
    mapping(bytes32 => Route[]) private zoneAgents;

    AgentRegistry public immutable registry;

    event ZoneAssigned(bytes32 indexed capability, AgentRegistry.Zone zone);
    event AgentZoneSet(address indexed agent, AgentRegistry.Zone zone);
    event TaskRouted(bytes32 indexed capability, AgentRegistry.Zone zone);

    constructor(address _registry) {
        registry = AgentRegistry(_registry);
    }

    function setZoneForCapability(string calldata _capability, AgentRegistry.Zone _zone) external {
        capabilityZone[keccak256(bytes(_capability))] = _zone;
        emit ZoneAssigned(keccak256(bytes(_capability)), _zone);
    }

    function getZoneForCapability(string calldata _capability) public view returns (AgentRegistry.Zone) {
        return capabilityZone[keccak256(bytes(_capability))];
    }

    function getAgentZone(address _agent) external view returns (AgentRegistry.Zone) {
        return agentZone[_agent];
    }

    function syncAgentZone(address _agent) external {
        AgentRegistry.Zone zone = registry.getZone(_agent);
        agentZone[_agent] = zone;
        emit AgentZoneSet(_agent, zone);
    }

    function routeTask(string calldata _capability) external returns (AgentRegistry.Zone) {
        AgentRegistry.Zone zone = getZoneForCapability(_capability);
        emit TaskRouted(keccak256(bytes(_capability)), zone);
        return zone;
    }

    function registerZoneAgent(string calldata _capability, address _agent) external {
        require(registry.isActive(_agent), "Agent inactive");
        require(registry.hasCapability(_agent, _capability), "Agent lacks capability");

        AgentRegistry.Zone zone = getZoneForCapability(_capability);
        bytes32 key = keccak256(bytes(_capability));
        for (uint256 i = 0; i < zoneAgents[key].length; i++) {
            require(zoneAgents[key][i].agent != _agent, "Agent already in zone");
        }
        zoneAgents[key].push(Route({ agent: _agent, zone: zone }));
    }

    function getZoneAgents(string calldata _capability) external view returns (Route[] memory) {
        return zoneAgents[keccak256(bytes(_capability))];
    }

    function getZoneAgentCount(string calldata _capability) external view returns (uint256) {
        return zoneAgents[keccak256(bytes(_capability))].length;
    }
}
