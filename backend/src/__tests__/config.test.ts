import { describe, it, expect, beforeEach, vi } from "vitest";

describe("config defaults", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses default port 3000 when PORT is not set", async () => {
    process.env = {
      VENICE_API_KEY: "test-key",
      AGENT_REGISTRY_ADDRESS: "0x" + "a".repeat(40),
      AGENT_REPUTATION_ADDRESS: "0x" + "b".repeat(40),
      TASK_COORDINATOR_ADDRESS: "0x" + "c".repeat(40),
    };
    delete process.env.PORT;
    const { config } = await import("../config");
    expect(config.port).toBe(3000);
  });

  it("uses custom port when PORT is set", async () => {
    process.env = {
      PORT: "4000",
      VENICE_API_KEY: "test-key",
      AGENT_REGISTRY_ADDRESS: "0x" + "a".repeat(40),
      AGENT_REPUTATION_ADDRESS: "0x" + "b".repeat(40),
      TASK_COORDINATOR_ADDRESS: "0x" + "c".repeat(40),
    };
    const { config } = await import("../config");
    expect(config.port).toBe(4000);
  });

  it("falls back to default Quai RPC", async () => {
    process.env = {
      VENICE_API_KEY: "test-key",
      AGENT_REGISTRY_ADDRESS: "0x" + "a".repeat(40),
      AGENT_REPUTATION_ADDRESS: "0x" + "b".repeat(40),
      TASK_COORDINATOR_ADDRESS: "0x" + "c".repeat(40),
    };
    delete process.env.QUAI_RPC_URL;
    const { config } = await import("../config");
    expect(config.quaiRpcUrl).toBe("https://orchard.rpc.quai.network/cyprus1");
  });

  it("throws when required env vars are missing", async () => {
    process.env = {};
    const { config } = await import("../config");
    expect(() => config.contracts.agentRegistry).toThrow("Missing env var: AGENT_REGISTRY_ADDRESS");
  });
});
