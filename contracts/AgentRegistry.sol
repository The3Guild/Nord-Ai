// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./utils/OwnableLite.sol";

contract AgentRegistry is OwnableLite {
    enum Zone {
        Research,
        Rwa,
        Risk,
        Audit,
        Automation
    }

    struct Agent {
        address owner;
        string metadataURI;
        string[] capabilities;
        uint256 price;
        Zone zone;
        uint256 reputationRef;
        bool active;
    }

    mapping(address => Agent) private agents;
    address[] private agentAddresses;
    mapping(address => uint256) private agentIndexPlusOne;

    event AgentRegistered(address indexed agent, address owner, string metadataURI, Zone zone);
    event AgentUpdated(address indexed agent, string metadataURI, uint256 price);
    event CapabilitiesSet(address indexed agent, string[] capabilities);
    event AgentDeactivated(address indexed agent);
    event AgentReactivated(address indexed agent);

    constructor() OwnableLite(msg.sender) {}

    function registerAgent(
        address _agent,
        string calldata _metadataURI,
        string[] calldata _capabilities,
        uint256 _price,
        Zone _zone
    ) external {
        require(_agent != address(0), "Agent required");
        require(agents[_agent].owner == address(0), "Agent already registered");
        require(bytes(_metadataURI).length > 0, "Metadata required");
        require(_capabilities.length > 0, "At least one capability required");

        Agent storage agent = agents[_agent];
        agent.owner = msg.sender;
        agent.metadataURI = _metadataURI;
        agent.price = _price;
        agent.zone = _zone;
        agent.reputationRef = 0;
        agent.active = true;
        _writeCapabilities(agent, _capabilities);
        agentAddresses.push(_agent);
        agentIndexPlusOne[_agent] = agentAddresses.length;

        emit AgentRegistered(_agent, msg.sender, _metadataURI, _zone);
    }

    function updateAgent(
        address _agent,
        string calldata _metadataURI,
        uint256 _price
    ) external {
        Agent storage agent = agents[_agent];
        require(agent.owner == msg.sender, "Not agent owner");
        require(bytes(_metadataURI).length > 0, "Metadata required");
        agent.metadataURI = _metadataURI;
        agent.price = _price;

        emit AgentUpdated(_agent, _metadataURI, _price);
    }

    function setCapabilities(address _agent, string[] calldata _capabilities) external {
        Agent storage agent = agents[_agent];
        require(agent.owner == msg.sender, "Not agent owner");
        require(_capabilities.length > 0, "At least one capability required");
        delete agent.capabilities;
        _writeCapabilities(agent, _capabilities);

        emit CapabilitiesSet(_agent, _capabilities);
    }

    function deactivateAgent(address _agent) external {
        Agent storage agent = agents[_agent];
        require(agent.owner == msg.sender, "Not agent owner");
        require(agent.active, "Agent already inactive");
        agent.active = false;

        emit AgentDeactivated(_agent);
    }

    function reactivateAgent(address _agent) external {
        Agent storage agent = agents[_agent];
        require(agent.owner == msg.sender, "Not agent owner");
        require(!agent.active, "Agent already active");
        agent.active = true;

        emit AgentReactivated(_agent);
    }

    function getAgent(address _agent) external view returns (Agent memory) {
        return agents[_agent];
    }

    function isRegistered(address _agent) external view returns (bool) {
        return agents[_agent].owner != address(0);
    }

    function isActive(address _agent) external view returns (bool) {
        return agents[_agent].active;
    }

    function getZone(address _agent) external view returns (Zone) {
        return agents[_agent].zone;
    }

    function getAgentCount() external view returns (uint256) {
        return agentAddresses.length;
    }

    function getAgentAt(uint256 _index) external view returns (address) {
        return agentAddresses[_index];
    }

    function getAgentIndex(address _agent) external view returns (uint256) {
        require(agentIndexPlusOne[_agent] != 0, "Agent not registered");
        return agentIndexPlusOne[_agent] - 1;
    }

    function hasCapability(address _agent, string calldata _capability) external view returns (bool) {
        string[] storage capabilities = agents[_agent].capabilities;
        for (uint256 i = 0; i < capabilities.length; i++) {
            if (keccak256(bytes(capabilities[i])) == keccak256(bytes(_capability))) {
                return true;
            }
        }
        return false;
    }

    function _writeCapabilities(Agent storage agent, string[] calldata _capabilities) private {
        for (uint256 i = 0; i < _capabilities.length; i++) {
            require(bytes(_capabilities[i]).length > 0, "Capability required");
            for (uint256 j = 0; j < i; j++) {
                require(
                    keccak256(bytes(_capabilities[i])) != keccak256(bytes(_capabilities[j])),
                    "Duplicate capability"
                );
            }
            agent.capabilities.push(_capabilities[i]);
        }
    }
}
