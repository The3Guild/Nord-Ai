// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";
import "./utils/OwnableLite.sol";

contract ZoneRouter is OwnableLite {
    struct Route {
        address agent;
        AgentRegistry.Zone zone;
    }

    mapping(bytes32 => AgentRegistry.Zone) private capabilityZone;
    mapping(bytes32 => bool) private capabilityConfigured;
    mapping(address => AgentRegistry.Zone) private agentZone;
    mapping(bytes32 => Route[]) private zoneAgents;

    AgentRegistry public immutable registry;

    event ZoneAssigned(bytes32 indexed capability, AgentRegistry.Zone zone);
    event AgentZoneSet(address indexed agent, AgentRegistry.Zone zone);
    event TaskRouted(bytes32 indexed capability, AgentRegistry.Zone zone);

    constructor(address _registry) OwnableLite(msg.sender) {
        require(_registry != address(0), "Registry required");
        registry = AgentRegistry(_registry);
    }

    function setZoneForCapability(string calldata _capability, AgentRegistry.Zone _zone) external onlyOwner {
        bytes32 key = _capabilityKey(_capability);
        capabilityZone[key] = _zone;
        capabilityConfigured[key] = true;
        emit ZoneAssigned(key, _zone);
    }

    function getZoneForCapability(string calldata _capability) public view returns (AgentRegistry.Zone) {
        bytes32 key = _capabilityKey(_capability);
        require(capabilityConfigured[key], "Capability zone unset");
        return capabilityZone[key];
    }

    function getAgentZone(address _agent) external view returns (AgentRegistry.Zone) {
        return agentZone[_agent];
    }

    function syncAgentZone(address _agent) external {
        require(registry.isRegistered(_agent), "Agent not registered");
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
        AgentRegistry.Agent memory agent = registry.getAgent(_agent);
        require(agent.owner == msg.sender || msg.sender == owner, "Not agent owner");

        AgentRegistry.Zone zone = getZoneForCapability(_capability);
        require(registry.getZone(_agent) == zone, "Agent zone mismatch");
        bytes32 key = _capabilityKey(_capability);
        for (uint256 i = 0; i < zoneAgents[key].length; i++) {
            require(zoneAgents[key][i].agent != _agent, "Agent already in zone");
        }
        zoneAgents[key].push(Route({ agent: _agent, zone: zone }));
    }

    function getZoneAgents(string calldata _capability) external view returns (Route[] memory) {
        return zoneAgents[_capabilityKey(_capability)];
    }

    function getZoneAgentCount(string calldata _capability) external view returns (uint256) {
        return zoneAgents[_capabilityKey(_capability)].length;
    }

    function _capabilityKey(string calldata _capability) private pure returns (bytes32) {
        require(bytes(_capability).length > 0, "Capability required");
        return keccak256(bytes(_capability));
    }
}
