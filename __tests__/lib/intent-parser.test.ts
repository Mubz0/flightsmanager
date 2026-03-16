import { describe, it, expect } from "vitest";
import { FLIGHT_SEARCH_TOOL, parseIntentFromToolCall } from "@/lib/intent-parser";

describe("intent-parser", () => {
  describe("FLIGHT_SEARCH_TOOL", () => {
    it("has the correct function name", () => {
      expect(FLIGHT_SEARCH_TOOL.type).toBe("function");
      expect(FLIGHT_SEARCH_TOOL.function.name).toBe("search_flights");
    });
    it("requires legs parameter", () => {
      const required = FLIGHT_SEARCH_TOOL.function.parameters.required;
      expect(required).toContain("legs");
    });
  });
  describe("parseIntentFromToolCall", () => {
    it("parses a simple one-way search", () => {
      const args = JSON.stringify({ legs: [{ origin: "SZX", destination: "LHR", date: "2026-03-25" }] });
      const result = parseIntentFromToolCall(args);
      expect(result.legs).toHaveLength(1);
      expect(result.legs[0].origin).toBe("SZX");
    });
    it("parses multi-leg with exclusions", () => {
      const args = JSON.stringify({
        legs: [
          { origin: "BKK", destination: "CNX", date: "2026-03-20" },
          { origin: "CNX", destination: "HKG", date: "2026-03-22" },
          { origin: "SZX", destination: "LHR", date: "2026-03-25", date_flexibility: 2 },
        ],
        excluded_stopover_airports: ["DXB", "AUH", "DOH"],
        preferred_airlines: ["MU", "CZ", "CA"],
      });
      const result = parseIntentFromToolCall(args);
      expect(result.legs).toHaveLength(3);
      expect(result.excluded_stopover_airports).toEqual(["DXB", "AUH", "DOH"]);
    });
    it("throws on invalid JSON", () => { expect(() => parseIntentFromToolCall("not json")).toThrow(); });
    it("throws when legs is missing", () => { expect(() => parseIntentFromToolCall(JSON.stringify({}))).toThrow("legs"); });
  });
});
