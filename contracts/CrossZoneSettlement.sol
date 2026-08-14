// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TaskCoordinator.sol";
import "./utils/OwnableLite.sol";
import "./utils/ReentrancyGuardLite.sol";

contract CrossZoneSettlement is OwnableLite, ReentrancyGuardLite {
    enum SettlementStatus {
        Pending,
        InTransit,
        Received,
        Finalized,
        Refunded
    }

    struct CrossZoneSettlementRecord {
        uint256 taskId;
        address destinationZone;
        address payer;
        uint256 amount;
        SettlementStatus status;
        bytes data;
        bool exists;
    }

    mapping(uint256 => CrossZoneSettlementRecord) private settlements;

    TaskCoordinator public immutable coordinator;

    event SettlementInitiated(uint256 indexed taskId, address destinationZone, uint256 amount);
    event SettlementReceived(uint256 indexed taskId, uint256 amount);
    event CrossZoneTaskFinalized(uint256 indexed taskId);
    event SettlementRefunded(uint256 indexed taskId, address indexed payer, uint256 amount);

    constructor(address _coordinator) OwnableLite(msg.sender) {
        require(_coordinator != address(0), "Coordinator required");
        coordinator = TaskCoordinator(_coordinator);
    }

    function initiateSettlement(
        uint256 _taskId,
        address _destinationZone,
        bytes calldata _data
    ) external payable nonReentrant returns (uint256) {
        require(_destinationZone != address(0), "Destination required");
        require(msg.value > 0, "Must settle positive amount");
        require(!settlements[_taskId].exists, "Already initiated");

        settlements[_taskId] = CrossZoneSettlementRecord({
            taskId: _taskId,
            destinationZone: _destinationZone,
            payer: msg.sender,
            amount: msg.value,
            status: SettlementStatus.Pending,
            data: _data,
            exists: true
        });

        emit SettlementInitiated(_taskId, _destinationZone, msg.value);
        return _taskId;
    }

    function receiveSettlement(uint256 _taskId) external payable nonReentrant {
        CrossZoneSettlementRecord storage record = settlements[_taskId];
        require(record.exists, "Settlement not found");
        require(record.status == SettlementStatus.Pending, "Not pending");

        record.amount += msg.value;
        record.status = SettlementStatus.Received;

        emit SettlementReceived(_taskId, msg.value);
    }

    function finalizeCrossZoneTask(uint256 _taskId) external nonReentrant onlyOwner {
        CrossZoneSettlementRecord storage record = settlements[_taskId];
        require(record.exists, "Settlement not found");
        require(record.status == SettlementStatus.Received, "Not received");

        record.status = SettlementStatus.Finalized;
        TaskCoordinator.Task memory task = coordinator.getTask(_taskId);
        address agent = task.selectedAgent;
        require(agent != address(0), "No assigned agent");

        uint256 amount = record.amount;
        record.amount = 0;
        _sendValue(agent, amount);

        emit CrossZoneTaskFinalized(_taskId);
    }

    function refundSettlement(uint256 _taskId) external nonReentrant {
        CrossZoneSettlementRecord storage record = settlements[_taskId];
        require(record.exists, "Settlement not found");
        require(msg.sender == record.payer || msg.sender == owner, "Unauthorized");
        require(
            record.status == SettlementStatus.Pending || record.status == SettlementStatus.Received,
            "Invalid status"
        );

        record.status = SettlementStatus.Refunded;
        uint256 amount = record.amount;
        record.amount = 0;
        _sendValue(record.payer, amount);

        emit SettlementRefunded(_taskId, record.payer, amount);
    }

    function getSettlement(uint256 _taskId) external view returns (CrossZoneSettlementRecord memory) {
        require(settlements[_taskId].exists, "Settlement not found");
        return settlements[_taskId];
    }

    function getSettlementStatus(uint256 _taskId) external view returns (SettlementStatus) {
        require(settlements[_taskId].exists, "Settlement not found");
        return settlements[_taskId].status;
    }

    function _sendValue(address recipient, uint256 amount) private {
        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
