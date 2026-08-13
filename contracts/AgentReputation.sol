// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentReputation {
    enum Outcome {
        Success,
        Failure,
        Dispute,
        DisputeResolved
    }

    struct ReputationEvent {
        uint256 taskId;
        Outcome outcome;
        uint256 weight;
        uint256 timestamp;
    }

    mapping(address => uint256) private reputation;
    mapping(address => uint256) private completedTasks;
    mapping(address => uint256) private failedTasks;
    mapping(address => ReputationEvent[]) private history;

    address private coordinator;

    event ReputationUpdated(address indexed agent, uint256 newScore, Outcome outcome, uint256 taskId);
    event ReputationEventRecorded(address indexed agent, uint256 taskId, Outcome outcome, uint256 weight);
    event CoordinatorSet(address coordinator);

    modifier onlyCoordinator() {
        require(msg.sender == coordinator, "Only coordinator");
        _;
    }

    constructor() {
        coordinator = msg.sender;
    }

    function setCoordinator(address _coordinator) external onlyCoordinator {
        coordinator = _coordinator;
        emit CoordinatorSet(_coordinator);
    }

    function recordSuccess(address _agent, uint256 _taskId, uint256 _weight) external onlyCoordinator {
        _recordEvent(_agent, _taskId, Outcome.Success, _weight);
        completedTasks[_agent] += 1;
    }

    function recordFailure(address _agent, uint256 _taskId, uint256 _weight) external onlyCoordinator {
        _recordEvent(_agent, _taskId, Outcome.Failure, _weight);
        failedTasks[_agent] += 1;
    }

    function recordDispute(address _agent, uint256 _taskId, uint256 _weight) external onlyCoordinator {
        _recordEvent(_agent, _taskId, Outcome.Dispute, _weight);
    }

    function resolveDispute(address _agent, uint256 _taskId, bool _agentFaulted, uint256 _weight)
        external
        onlyCoordinator
    {
        _recordEvent(_agent, _taskId, Outcome.DisputeResolved, _weight);
        if (_agentFaulted) {
            failedTasks[_agent] += 1;
        } else {
            completedTasks[_agent] += 1;
        }
    }

    function _recordEvent(
        address _agent,
        uint256 _taskId,
        Outcome _outcome,
        uint256 _weight
    ) private {
        int256 delta = _scoreDelta(_outcome, _weight);
        int256 current = int256(reputation[_agent]);
        int256 next = current + delta < 0 ? int256(0) : current + delta;
        reputation[_agent] = uint256(next);

        history[_agent].push(ReputationEvent({
            taskId: _taskId,
            outcome: _outcome,
            weight: _weight,
            timestamp: block.timestamp
        }));

        emit ReputationUpdated(_agent, reputation[_agent], _outcome, _taskId);
        emit ReputationEventRecorded(_agent, _taskId, _outcome, _weight);
    }

    function _scoreDelta(Outcome _outcome, uint256 _weight) private pure returns (int256) {
        if (_outcome == Outcome.Success) return int256(_weight);
        if (_outcome == Outcome.Failure) return -int256(_weight);
        if (_outcome == Outcome.Dispute) return 0;
        return -int256(_weight / 2);
    }

    function getReputation(address _agent) external view returns (uint256) {
        return reputation[_agent];
    }

    function getAgentHistory(address _agent) external view returns (ReputationEvent[] memory) {
        return history[_agent];
    }

    function getCompletedTasks(address _agent) external view returns (uint256) {
        return completedTasks[_agent];
    }

    function getFailedTasks(address _agent) external view returns (uint256) {
        return failedTasks[_agent];
    }
}
