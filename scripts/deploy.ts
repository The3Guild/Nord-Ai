import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NORD-AI contracts with account:", deployer.address);

  const registry = await ethers.deployContract("AgentRegistry");
  await registry.waitForDeployment();
  console.log("AgentRegistry deployed at:", await registry.getAddress());

  const reputation = await ethers.deployContract("AgentReputation");
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("AgentReputation deployed at:", reputationAddress);

  const coordinator = await ethers.deployContract("TaskCoordinator", [
    await registry.getAddress(),
    reputationAddress,
  ]);
  await coordinator.waitForDeployment();
  const coordinatorAddress = await coordinator.getAddress();
  console.log("TaskCoordinator deployed at:", coordinatorAddress);

  await reputation.setCoordinator(coordinatorAddress);
  console.log("AgentReputation coordinator set to TaskCoordinator");

  const router = await ethers.deployContract("ZoneRouter", [await registry.getAddress()]);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("ZoneRouter deployed at:", routerAddress);

  await router.setZoneForCapability("web-research", 0);
  await router.setZoneForCapability("rwa-research", 1);
  await router.setZoneForCapability("risk-analysis", 2);
  await router.setZoneForCapability("audit", 3);
  await router.setZoneForCapability("automation", 4);
  console.log("ZoneRouter default capability mappings configured");

  const settlement = await ethers.deployContract("CrossZoneSettlement", [coordinatorAddress]);
  await settlement.waitForDeployment();
  console.log("CrossZoneSettlement deployed at:", await settlement.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
