// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/AgentRegistry.sol";
import "../../contracts/AgentReputation.sol";
import "../../contracts/TaskCoordinator.sol";
import "../../contracts/ZoneRouter.sol";

contract NordAiActor {
    receive() external payable {}

    function registerAgent(
        AgentRegistry registry,
        address agent,
        string calldata metadataURI,
        string[] calldata capabilities,
        uint256 price,
        AgentRegistry.Zone zone
    ) external {
        registry.registerAgent(agent, metadataURI, capabilities, price, zone);
    }

    function createTask(
        TaskCoordinator coordinator,
        string calldata capability,
        uint256 budget,
        AgentRegistry.Zone zone
    ) external returns (uint256) {
        return coordinator.createTask{ value: budget }(capability, budget, zone);
    }

    function routeTask(TaskCoordinator coordinator, uint256 taskId) external {
        coordinator.routeTask(taskId);
    }

    function assignAgent(TaskCoordinator coordinator, uint256 taskId, address agent) external {
        coordinator.assignAgent(taskId, agent);
    }

    function acceptAssignment(TaskCoordinator coordinator, uint256 taskId) external {
        coordinator.acceptAssignment(taskId);
    }

    function submitEvidence(TaskCoordinator coordinator, uint256 taskId, bytes32 resultHash) external {
        coordinator.submitEvidence(taskId, resultHash);
    }

    function verifyTask(TaskCoordinator coordinator, uint256 taskId) external {
        coordinator.verifyTask(taskId);
    }

    function completeTask(TaskCoordinator coordinator, uint256 taskId) external {
        coordinator.completeTask(taskId);
    }

    function failTask(TaskCoordinator coordinator, uint256 taskId, string calldata reason) external {
        coordinator.failTask(taskId, reason);
    }

    function cancelTask(TaskCoordinator coordinator, uint256 taskId) external {
        coordinator.cancelTask(taskId);
    }
}

contract NordAiTest {
    AgentRegistry private registry;
    AgentReputation private reputation;
    TaskCoordinator private coordinator;
    ZoneRouter private router;
    NordAiActor private requester;
    NordAiActor private agentOwner;
    NordAiActor private agentWallet;

    receive() external payable {}

    function setUp() public {
        registry = new AgentRegistry();
        reputation = new AgentReputation();
        coordinator = new TaskCoordinator(address(registry), address(reputation));
        reputation.setCoordinator(address(coordinator));
        router = new ZoneRouter(address(registry));
        router.setZoneForCapability("rwa-research", AgentRegistry.Zone.Rwa);

        requester = new NordAiActor();
        agentOwner = new NordAiActor();
        agentWallet = new NordAiActor();

        payable(address(requester)).transfer(10 ether);
    }

    function testRegisterAgentAndRouteCapability() public {
        _registerRwaAgent();

        AgentRegistry.Agent memory agent = registry.getAgent(address(agentWallet));
        _assertEq(agent.owner, address(agentOwner), "agent owner");
        _assertTrue(agent.active, "agent should be active");
        _assertTrue(registry.hasCapability(address(agentWallet), "rwa-research"), "capability");

        router.registerZoneAgent("rwa-research", address(agentWallet));
        _assertEq(uint256(router.getZoneForCapability("rwa-research")), 1, "zone");
        _assertEq(router.getZoneAgentCount("rwa-research"), 1, "zone agent count");
    }

    function testFullLifecycleSettlesAndRecordsReputation() public {
        _registerRwaAgent();

        uint256 budget = 1 ether;
        uint256 taskId = requester.createTask(
            coordinator,
            "rwa-research",
            budget,
            AgentRegistry.Zone.Rwa
        );
        requester.routeTask(coordinator, taskId);
        requester.assignAgent(coordinator, taskId, address(agentWallet));
        agentWallet.acceptAssignment(coordinator, taskId);

        bytes32 resultHash = keccak256("RWA analysis report");
        agentWallet.submitEvidence(coordinator, taskId, resultHash);
        requester.verifyTask(coordinator, taskId);

        uint256 balanceBefore = address(agentWallet).balance;
        requester.completeTask(coordinator, taskId);

        _assertEq(address(agentWallet).balance - balanceBefore, budget, "agent paid");
        _assertEq(uint256(coordinator.getTaskStatus(taskId)), 8, "settled status");
        _assertEq(reputation.getCompletedTasks(address(agentWallet)), 1, "completed tasks");
        _assertEq(reputation.getReputation(address(agentWallet)), 10, "reputation");
    }

    function testRequesterFailureRefundsAndRecordsAgentFailure() public {
        _registerRwaAgent();

        uint256 budget = 0.5 ether;
        uint256 taskId = requester.createTask(
            coordinator,
            "rwa-research",
            budget,
            AgentRegistry.Zone.Rwa
        );
        requester.routeTask(coordinator, taskId);
        requester.assignAgent(coordinator, taskId, address(agentWallet));

        uint256 balanceBefore = address(requester).balance;
        requester.failTask(coordinator, taskId, "agent did not respond");

        _assertEq(address(requester).balance - balanceBefore, budget, "requester refund");
        _assertEq(uint256(coordinator.getTaskStatus(taskId)), 11, "failed status");
        _assertEq(reputation.getFailedTasks(address(agentWallet)), 1, "failed tasks");
        _assertEq(reputation.getReputation(address(agentWallet)), 0, "floored reputation");
    }

    function testCancelBeforeExecutionRefundsWithoutReputationPenalty() public {
        _registerRwaAgent();

        uint256 budget = 0.25 ether;
        uint256 taskId = requester.createTask(
            coordinator,
            "rwa-research",
            budget,
            AgentRegistry.Zone.Rwa
        );
        requester.routeTask(coordinator, taskId);
        requester.assignAgent(coordinator, taskId, address(agentWallet));

        uint256 balanceBefore = address(requester).balance;
        requester.cancelTask(coordinator, taskId);

        _assertEq(address(requester).balance - balanceBefore, budget, "requester refund");
        _assertEq(uint256(coordinator.getTaskStatus(taskId)), 12, "cancelled status");
        _assertEq(reputation.getFailedTasks(address(agentWallet)), 0, "no failure");
    }

    function testRejectsWrongZoneAgentAssignment() public {
        string[] memory caps = new string[](1);
        caps[0] = "rwa-research";
        agentOwner.registerAgent(
            registry,
            address(agentWallet),
            "ipfs://nord-ai-agent",
            caps,
            100,
            AgentRegistry.Zone.Research
        );

        uint256 taskId = requester.createTask(
            coordinator,
            "rwa-research",
            1 ether,
            AgentRegistry.Zone.Rwa
        );
        requester.routeTask(coordinator, taskId);

        try requester.assignAgent(coordinator, taskId, address(agentWallet)) {
            revert("assignment should fail");
        } catch {}
    }

    function _registerRwaAgent() private {
        string[] memory caps = new string[](1);
        caps[0] = "rwa-research";
        agentOwner.registerAgent(
            registry,
            address(agentWallet),
            "ipfs://nord-ai-rwa-agent",
            caps,
            100,
            AgentRegistry.Zone.Rwa
        );
    }

    function _assertTrue(bool condition, string memory message) private pure {
        require(condition, message);
    }

    function _assertEq(address actual, address expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }
}
