import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

async function deployNORD() {
  const [deployer, requester, agentWallet, otherAgentWallet] = await ethers.getSigners();

  const registry = await ethers.deployContract("AgentRegistry");
  await registry.waitForDeployment();

  const reputation = await ethers.deployContract("AgentReputation");
  await reputation.waitForDeployment();

  const coordinator = await ethers.deployContract("TaskCoordinator", [
    await registry.getAddress(),
    await reputation.getAddress(),
  ]);
  await coordinator.waitForDeployment();

  await reputation.setCoordinator(await coordinator.getAddress());

  const router = await ethers.deployContract("ZoneRouter", [await registry.getAddress()]);
  await router.waitForDeployment();
  await router.setZoneForCapability("rwa-research", 1);
  await router.setZoneForCapability("risk-analysis", 2);

  const settlement = await ethers.deployContract("CrossZoneSettlement", [
    await coordinator.getAddress(),
  ]);
  await settlement.waitForDeployment();

  return {
    deployer,
    requester,
    agentWallet,
    otherAgentWallet,
    registry,
    reputation,
    coordinator,
    router,
    settlement,
  };
}

describe("NORD-AI protocol", function () {
  it("registers an agent and exposes its profile", async function () {
    const { deployer, agentWallet, registry } = await loadFixture(deployNORD);

    const capabilities = ["rwa-research", "web-research"];
    await registry.registerAgent(
      await agentWallet.getAddress(),
      "ipfs://nord-ai-rwa-agent",
      capabilities,
      100,
      1,
    );

    const agent = await registry.getAgent(await agentWallet.getAddress());
    expect(agent.owner).to.equal(await deployer.getAddress());
    expect(agent.active).to.equal(true);
    expect(await registry.hasCapability(await agentWallet.getAddress(), "rwa-research")).to.equal(true);
    expect(await registry.isRegistered(await agentWallet.getAddress())).to.equal(true);
  });

  it("executes a full funded task lifecycle and settles the agent", async function () {
    const { requester, agentWallet, registry, coordinator, reputation } = await loadFixture(deployNORD);

    await registry.registerAgent(
      await agentWallet.getAddress(),
      "ipfs://nord-ai-rwa-agent",
      ["rwa-research"],
      100,
      1,
    );

    const budget = ethers.parseEther("1.0");
    const taskId = await coordinator.getTaskCount();
    await coordinator.connect(requester).createTask("rwa-research", budget, 1, { value: budget });
    await coordinator.connect(requester).routeTask(taskId);
    await coordinator.connect(requester).assignAgent(taskId, await agentWallet.getAddress());
    await coordinator.connect(agentWallet).acceptAssignment(taskId);

    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("RWA analysis report"));
    await coordinator.connect(agentWallet).submitEvidence(taskId, resultHash);
    await coordinator.connect(requester).verifyTask(taskId);

    const agentBalanceBefore = await ethers.provider.getBalance(await agentWallet.getAddress());
    await coordinator.connect(requester).completeTask(taskId);
    const agentBalanceAfter = await ethers.provider.getBalance(await agentWallet.getAddress());

    expect(agentBalanceAfter - agentBalanceBefore).to.equal(budget);
    expect(await coordinator.getTaskStatus(taskId)).to.equal(8);
    expect(await reputation.getCompletedTasks(await agentWallet.getAddress())).to.equal(1);
    expect(await reputation.getReputation(await agentWallet.getAddress())).to.equal(10);
  });

  it("records failure reputation and refunds the requester", async function () {
    const { requester, agentWallet, registry, coordinator, reputation } = await loadFixture(deployNORD);

    await registry.registerAgent(
      await agentWallet.getAddress(),
      "ipfs://nord-ai-risk-agent",
      ["risk-analysis"],
      100,
      2,
    );

    const budget = ethers.parseEther("0.5");
    const taskId = await coordinator.getTaskCount();
    await coordinator.connect(requester).createTask("risk-analysis", budget, 2, { value: budget });
    await coordinator.connect(requester).routeTask(taskId);
    await coordinator.connect(requester).assignAgent(taskId, await agentWallet.getAddress());

    const requesterBalanceBefore = await ethers.provider.getBalance(await requester.getAddress());
    await coordinator.connect(requester).failTask(taskId, "agent did not respond");
    const requesterBalanceAfter = await ethers.provider.getBalance(await requester.getAddress());
    const refundDelta = requesterBalanceAfter - requesterBalanceBefore;

    expect(refundDelta).to.be.greaterThan(ethers.parseEther("0.49"));
    expect(refundDelta).to.be.lessThanOrEqual(budget);
    expect(await reputation.getFailedTasks(await agentWallet.getAddress())).to.equal(1);
    expect(await reputation.getReputation(await agentWallet.getAddress())).to.equal(0);
  });

  it("cancels an assigned task before execution without penalizing reputation", async function () {
    const { requester, agentWallet, registry, coordinator, reputation } = await loadFixture(deployNORD);

    await registry.registerAgent(
      await agentWallet.getAddress(),
      "ipfs://nord-ai-rwa-agent",
      ["rwa-research"],
      100,
      1,
    );

    const budget = ethers.parseEther("0.25");
    const taskId = await coordinator.getTaskCount();
    await coordinator.connect(requester).createTask("rwa-research", budget, 1, { value: budget });
    await coordinator.connect(requester).routeTask(taskId);
    await coordinator.connect(requester).assignAgent(taskId, await agentWallet.getAddress());

    const requesterBalanceBefore = await ethers.provider.getBalance(await requester.getAddress());
    await coordinator.connect(requester).cancelTask(taskId);
    const requesterBalanceAfter = await ethers.provider.getBalance(await requester.getAddress());
    const refundDelta = requesterBalanceAfter - requesterBalanceBefore;

    expect(refundDelta).to.be.greaterThan(ethers.parseEther("0.249"));
    expect(refundDelta).to.be.lessThanOrEqual(budget);
    expect(await coordinator.getTaskStatus(taskId)).to.equal(12);
    expect(await reputation.getFailedTasks(await agentWallet.getAddress())).to.equal(0);
  });

  it("rejects agent assignment when capability matches but zone does not", async function () {
    const { requester, agentWallet, registry, coordinator } = await loadFixture(deployNORD);

    await registry.registerAgent(
      await agentWallet.getAddress(),
      "ipfs://nord-ai-research-agent",
      ["rwa-research"],
      100,
      0,
    );

    const budget = ethers.parseEther("1.0");
    const taskId = await coordinator.getTaskCount();
    await coordinator.connect(requester).createTask("rwa-research", budget, 1, { value: budget });
    await coordinator.connect(requester).routeTask(taskId);

    await expect(
      coordinator.connect(requester).assignAgent(taskId, await agentWallet.getAddress()),
    ).to.be.revertedWith("Agent zone mismatch");
  });

  it("indexes routeable agents through the Hardhat-deployed router", async function () {
    const { deployer, agentWallet, registry, router } = await loadFixture(deployNORD);

    await registry.registerAgent(
      await agentWallet.getAddress(),
      "ipfs://nord-ai-rwa-agent",
      ["rwa-research"],
      100,
      1,
    );

    await router.registerZoneAgent("rwa-research", await agentWallet.getAddress());

    expect(await router.getZoneForCapability("rwa-research")).to.equal(1);
    expect(await router.getZoneAgentCount("rwa-research")).to.equal(1);

    const agent = await registry.getAgent(await agentWallet.getAddress());
    expect(agent.owner).to.equal(await deployer.getAddress());
  });
});
