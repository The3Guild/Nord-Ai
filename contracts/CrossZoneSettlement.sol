// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TaskCoordinator.sol";

contract CrossZoneSettlement {
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
        uint256 amount;
        SettlementStatus status;
        bytes data;
    }

    mapping(uint256 => CrossZoneSettlementRecord) private settlements;

    TaskCoordinator public immutable coordinator;

    event SettlementInitiated(uint256 indexed taskId, address destinationZone, uint256 amount);
    event SettlementReceived(uint256 indexed taskId, uint256 amount);
    event CrossZoneTaskFinalized(uint256 indexed taskId);

    constructor(address _coordinator) {
        coordinator = TaskCoordinator(_coordinator);
    }

    function initiateSettlement(
        uint256 _taskId,
        address _destinationZone,
        bytes calldata _data
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must settle positive amount");
        require(settlements[_taskId].status != SettlementStatus.Pending, "Already initiated");

        settlements[_taskId] = CrossZoneSettlementRecord({
            taskId: _taskId,
            destinationZone: _destinationZone,
            amount: msg.value,
            status: SettlementStatus.Pending,
            data: _data
        });

        emit SettlementInitiated(_taskId, _destinationZone, msg.value);
        return _taskId;
    }

    function receiveSettlement(uint256 _taskId) external payable {
        CrossZoneSettlementRecord storage record = settlements[_taskId];
        require(record.status == SettlementStatus.Pending, "Not pending");

        record.amount += msg.value;
        record.status = SettlementStatus.Received;

        emit SettlementReceived(_taskId, msg.value);
    }

    function finalizeCrossZoneTask(uint256 _taskId) external {
        CrossZoneSettlementRecord storage record = settlements[_taskId];
        require(record.status == SettlementStatus.Received, "Not received");

        record.status = SettlementStatus.Finalized;
        TaskCoordinator.Task memory task = coordinator.getTask(_taskId);
        address agent = task.selectedAgent;
        require(agent != address(0), "No assigned agent");

        uint256 amount = record.amount;
        record.amount = 0;
        payable(agent).transfer(amount);

        emit CrossZoneTaskFinalized(_taskId);
    }

    function getSettlement(uint256 _taskId) external view returns (CrossZoneSettlementRecord memory) {
        return settlements[_taskId];
    }

    function getSettlementStatus(uint256 _taskId) external view returns (SettlementStatus) {
        return settlements[_taskId].status;
    }
}
