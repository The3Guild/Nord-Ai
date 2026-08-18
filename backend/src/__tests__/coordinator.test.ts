import { describe, it, expect } from "vitest";

describe("coordinator address patterns", () => {
  describe("Quai address validation", () => {
    const VALID_ADDRESS = "0x" + "a".repeat(40);
    const INVALID_ADDRESS = "0x123";

    it("valid address matches pattern", () => {
      const re = /^0x[0-9a-fA-F]{40}$/;
      expect(re.test(VALID_ADDRESS)).toBe(true);
    });

    it("short address is rejected", () => {
      const re = /^0x[0-9a-fA-F]{40}$/;
      expect(re.test(INVALID_ADDRESS)).toBe(false);
    });

    it("address without 0x prefix is rejected", () => {
      const re = /^0x[0-9a-fA-F]{40}$/;
      expect(re.test("a".repeat(40))).toBe(false);
    });
  });

  describe("QUAI amount parsing", () => {
    it("parses 0.5 QUAI to wei", () => {
      const quai = "0.5";
      const wei = BigInt(Math.round(parseFloat(quai) * 1e18));
      expect(wei).toBe(500000000000000000n);
    });

    it("parses 1 QUAI to wei", () => {
      const wei = BigInt(Math.round(parseFloat("1") * 1e18));
      expect(wei).toBe(1000000000000000000n);
    });
  });

  describe("zone mapping", () => {
    const zoneMap: Record<string, number> = {
      research: 0, rwa: 1, risk: 2, audit: 3, coding: 4, design: 4, report: 3,
    };

    it("maps research to zone 0", () => {
      expect(zoneMap.research).toBe(0);
    });

    it("maps coding to zone 4 (Automation)", () => {
      expect(zoneMap.coding).toBe(4);
    });

    it("unknown capability defaults to zone 0", () => {
      expect(zoneMap["unknown"] ?? 0).toBe(0);
    });
  });
});
