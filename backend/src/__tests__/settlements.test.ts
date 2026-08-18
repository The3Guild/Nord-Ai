import { describe, it, expect } from "vitest";
import { getSettlements, addSettlement, getSettlementsByAgent } from "../settlements";

describe("settlements", () => {
  it("getSettlements returns an array", () => {
    const result = getSettlements();
    expect(Array.isArray(result)).toBe(true);
  });

  it("addSettlement persists a record with all fields", () => {
    const before = getSettlements().length;
    addSettlement({
      hash:       "0x" + "ab".repeat(32),
      from:       "0x" + "a".repeat(40),
      to:         "0x" + "b".repeat(40),
      amount:     "500000000000000000",
      capability: "research",
      taskId:     "test-1",
    });
    const after = getSettlements();
    expect(after.length).toBe(before + 1);
    const last = after[after.length - 1];
    expect(last.hash).toBe("0x" + "ab".repeat(32));
    expect(last.from).toBe("0x" + "a".repeat(40));
    expect(last.to).toBe("0x" + "b".repeat(40));
    expect(last.amount).toBe("500000000000000000");
    expect(last.capability).toBe("research");
    expect(last.taskId).toBe("test-1");
    expect(last.timestamp).toBeDefined();
  });

  it("getSettlementsByAgent filters by recipient", () => {
    const target = "0x" + "c".repeat(40);
    addSettlement({
      hash:       "0x" + "cd".repeat(32),
      from:       "0x" + "a".repeat(40),
      to:         target,
      amount:     "100000000000000000",
      capability: "coding",
      taskId:     "test-2",
    });
    const filtered = getSettlementsByAgent(target);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every(s => s.to === target)).toBe(true);
  });

  it("getSettlementsByAgent returns empty for unknown address", () => {
    const result = getSettlementsByAgent("0x" + "z".repeat(40));
    expect(result.length).toBe(0);
  });
});
