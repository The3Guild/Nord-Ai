import { describe, it, expect } from "vitest";

describe("x402 / settlement types", () => {
  describe("Quai address validation", () => {
    const RE = /^0x[0-9a-fA-F]{40}$/;

    it("valid address passes", () => {
      expect(RE.test("0x" + "a".repeat(40))).toBe(true);
    });

    it("short address fails", () => {
      expect(RE.test("0x123")).toBe(false);
    });

    it("no prefix fails", () => {
      expect(RE.test("a".repeat(40))).toBe(false);
    });
  });

  describe("settlePayment interface", () => {
    it("SettleResult has required fields", () => {
      type SettleResult = {
        hash: string;
        from: string;
        to: string;
        amount: string;
        blockNumber?: number;
      };
      const result: SettleResult = {
        hash: "0x" + "ab".repeat(32),
        from: "0x" + "a".repeat(40),
        to: "0x" + "b".repeat(40),
        amount: "500000000000000000",
      };
      expect(result.hash).toHaveLength(66);
      expect(result.from).toHaveLength(42);
      expect(result.to).toHaveLength(42);
      expect(BigInt(result.amount)).toBe(500000000000000000n);
    });
  });
});
