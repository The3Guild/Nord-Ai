// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";
import "./AgentReputation.sol";
import "./utils/OwnableLite.sol";
import "./utils/ReentrancyGuardLite.sol";

contract TaskCoordinator is OwnableLite, ReentrancyGuardLite {
    enum TaskStatus {
        Created,
        Routed,
        Funded,
        Assigned,
        Executing,
        EvidenceSubmitted,
        Verified,
        Completed,
        Settled,
        Disputed,
        Resolved,
        Failed,
        Cancelled
    }

    struct Task {
        address requester;
        string capability;
        uint256 budget;
        address selectedAgent;
        AgentRegistry.Zone zone;
        TaskStatus status;
        uint256 deadline;
        bytes32 resultHash;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 settledAt;
    }

    mapping(uint256 => Task) private tasks;
    uint256 private nextTaskId;

    AgentRegistry public immutable registry;
    AgentReputation public immutable reputation;

    uint256 public successWeight = 10;
    uint256 public failureWeight = 20;
    uint256 public defaultDeadlineDuration = 7 days;

    event TaskCreated(uint256 indexed taskId, address requester, string capability, uint256 budget, AgentRegistry.Zone zone);
    event TaskRouted(uint256 indexed taskId, AgentRegistry.Zone zone);
    event TaskFunded(uint256 indexed taskId, address requester, uint256 amount);
    event AgentAssigned(uint256 indexed taskId, address indexed agent);
    event EvidenceSubmitted(uint256 indexed taskId, bytes32 resultHash);
    event TaskVerified(uint256 indexed taskId);
    event TaskCompleted(uint256 indexed taskId);
    event TaskFailed(uint256 indexed taskId, string reason);
    event TaskSettled(uint256 indexed taskId, address indexed agent, uint256 amount);
    event TaskDisputed(uint256 indexed taskId);
    event TaskResolved(uint256 indexed taskId, address indexed agent);
    event AssignmentAccepted(uint256 indexed taskId, address indexed agent);
    event TaskCancelled(uint256 indexed taskId, address indexed requester, uint256 refund);
    event WeightsUpdated(uint256 successWeight, uint256 failureWeight);
    event DefaultDeadlineDurationUpdated(uint256 duration);

    constructor(address _registry, address _reputation) OwnableLite(msg.sender) {
        require(_registry != address(0), "Registry required");
        require(_reputation != address(0), "Reputation required");
        registry = AgentRegistry(_registry);
        reputation = AgentReputation(_reputation);
    }

    function createTask(
        string calldata _capability,
        uint256 _budget,
        AgentRegistry.Zone _zone
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == _budget, "Budget must equal value sent");
        require(_budget > 0, "Budget must be positive");
        require(bytes(_capability).length > 0, "Capability required");

        uint256 taskId = nextTaskId++;
        tasks[taskId] = Task({
            requester: msg.sender,
            capability: _capability,
            budget: _budget,
            selectedAgent: address(0),
            zone: _zone,
            status: TaskStatus.Created,
            deadline: block.timestamp + defaultDeadlineDuration,
            resultHash: bytes32(0),
            createdAt: block.timestamp,
            acceptedAt: 0,
            settledAt: 0
        });

        emit TaskCreated(taskId, msg.sender, _capability, _budget, _zone);
        return taskId;
    }

    function fundTask(uint256 _taskId) external payable nonReentrant {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can fund");
        require(task.status == TaskStatus.Created || task.status == TaskStatus.Routed, "Invalid status");
        require(msg.value > 0, "Must fund positive amount");

        task.budget += msg.value;
        task.status = TaskStatus.Funded;

        emit TaskFunded(_taskId, msg.sender, msg.value);
    }

    function routeTask(uint256 _taskId) external {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender || msg.sender == address(this), "Unauthorized");
        require(task.status == TaskStatus.Created || task.status == TaskStatus.Funded, "Invalid status");
        task.status = TaskStatus.Routed;

        emit TaskRouted(_taskId, task.zone);
    }

    function assignAgent(uint256 _taskId, address _agent) external {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can assign");
        require(task.status == TaskStatus.Routed || task.status == TaskStatus.Funded, "Invalid status");
        require(block.timestamp <= task.deadline, "Task expired");
        require(registry.isRegistered(_agent), "Agent not registered");
        require(registry.isActive(_agent), "Agent inactive");
        require(registry.hasCapability(_agent, task.capability), "Agent lacks capability");
        require(registry.getZone(_agent) == task.zone, "Agent zone mismatch");

        task.selectedAgent = _agent;
        task.status = TaskStatus.Assigned;

        emit AgentAssigned(_taskId, _agent);
    }

    function acceptAssignment(uint256 _taskId) external {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(
            task.selectedAgent == msg.sender || task.requester == msg.sender,
            "Only assigned agent or requester"
        );
        require(task.status == TaskStatus.Assigned, "Invalid status");
        require(block.timestamp <= task.deadline, "Task expired");

        task.status = TaskStatus.Executing;
        task.acceptedAt = block.timestamp;

        emit AssignmentAccepted(_taskId, msg.sender);
    }

    function submitEvidence(uint256 _taskId, bytes32 _resultHash) external {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(
            task.selectedAgent == msg.sender || task.requester == msg.sender,
            "Only assigned agent or requester"
        );
        require(task.status == TaskStatus.Assigned || task.status == TaskStatus.Executing, "Invalid status");
        require(block.timestamp <= task.deadline, "Task expired");
        require(_resultHash != bytes32(0), "Empty result hash");

        task.resultHash = _resultHash;
        task.status = TaskStatus.EvidenceSubmitted;

        emit EvidenceSubmitted(_taskId, _resultHash);
    }

    function verifyTask(uint256 _taskId) external {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can verify");
        require(task.status == TaskStatus.EvidenceSubmitted, "Invalid status");
        task.status = TaskStatus.Verified;

        emit TaskVerified(_taskId);
    }

    function completeTask(uint256 _taskId) external nonReentrant {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can complete");
        require(task.status == TaskStatus.Verified, "Invalid status");

        task.status = TaskStatus.Completed;
        _settle(_taskId);

        emit TaskCompleted(_taskId);
    }

    function failTask(uint256 _taskId, string calldata _reason) external nonReentrant {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can fail task");
        require(
            task.status == TaskStatus.Assigned ||
                task.status == TaskStatus.Executing ||
                task.status == TaskStatus.EvidenceSubmitted ||
                task.status == TaskStatus.Verified,
            "Invalid status"
        );

        task.status = TaskStatus.Failed;
        if (task.selectedAgent != address(0)) {
            reputation.recordFailure(task.selectedAgent, _taskId, failureWeight);
        }
        uint256 amount = task.budget;
        task.budget = 0;
        _sendValue(task.requester, amount);

        emit TaskFailed(_taskId, _reason);
    }

    function cancelTask(uint256 _taskId) external nonReentrant {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can cancel");
        require(
            task.status == TaskStatus.Created ||
                task.status == TaskStatus.Routed ||
                task.status == TaskStatus.Funded ||
                task.status == TaskStatus.Assigned,
            "Invalid status"
        );

        task.status = TaskStatus.Cancelled;
        uint256 amount = task.budget;
        task.budget = 0;
        _sendValue(task.requester, amount);

        emit TaskCancelled(_taskId, msg.sender, amount);
    }

    function disputeTask(uint256 _taskId) external {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can dispute");
        require(task.status == TaskStatus.EvidenceSubmitted || task.status == TaskStatus.Verified, "Invalid status");
        task.status = TaskStatus.Disputed;
        if (task.selectedAgent != address(0)) {
            reputation.recordDispute(task.selectedAgent, _taskId, failureWeight);
        }

        emit TaskDisputed(_taskId);
    }

    function resolveTask(uint256 _taskId, bool _agentFaulted) external nonReentrant {
        Task storage task = tasks[_taskId];
        _requireTaskExists(_taskId);
        require(task.requester == msg.sender, "Only requester can resolve");
        require(task.status == TaskStatus.Disputed, "Invalid status");

        if (_agentFaulted) {
            task.status = TaskStatus.Resolved;
            reputation.resolveDispute(task.selectedAgent, _taskId, true, failureWeight);
            uint256 amount = task.budget;
            task.budget = 0;
            _sendValue(task.requester, amount);
        } else {
            task.status = TaskStatus.Completed;
            reputation.resolveDispute(task.selectedAgent, _taskId, false, failureWeight);
            _settle(_taskId);
        }

        emit TaskResolved(_taskId, task.selectedAgent);
    }

    function _settle(uint256 _taskId) private {
        Task storage task = tasks[_taskId];
        require(task.selectedAgent != address(0), "No assigned agent");
        require(task.budget > 0, "No budget");
        reputation.recordSuccess(task.selectedAgent, _taskId, successWeight);
        uint256 amount = task.budget;
        task.budget = 0;
        task.settledAt = block.timestamp;
        task.status = TaskStatus.Settled;
        _sendValue(task.selectedAgent, amount);

        emit TaskSettled(_taskId, task.selectedAgent, amount);
    }

    function setWeights(uint256 _successWeight, uint256 _failureWeight) external onlyOwner {
        require(_successWeight > 0, "Success weight required");
        require(_failureWeight > 0, "Failure weight required");
        successWeight = _successWeight;
        failureWeight = _failureWeight;
        emit WeightsUpdated(_successWeight, _failureWeight);
    }

    function setDefaultDeadlineDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 hours, "Duration too short");
        defaultDeadlineDuration = _duration;
        emit DefaultDeadlineDurationUpdated(_duration);
    }

    function getTask(uint256 _taskId) external view returns (Task memory) {
        _requireTaskExists(_taskId);
        return tasks[_taskId];
    }

    function getTaskStatus(uint256 _taskId) external view returns (TaskStatus) {
        _requireTaskExists(_taskId);
        return tasks[_taskId].status;
    }

    function getTaskCount() external view returns (uint256) {
        return nextTaskId;
    }

    function _requireTaskExists(uint256 _taskId) private view {
        require(_taskId < nextTaskId, "Task not found");
    }

    function _sendValue(address recipient, uint256 amount) private {
        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
