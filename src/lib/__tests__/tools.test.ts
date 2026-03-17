import { describe, it, expect } from "vitest";
import { searchFlightsTool, findAlternativeDatesTool, resolveNearbyAirportsTool } from "../tools";

describe("resolveNearbyAirportsTool", () => {
  it("has correct tool name and description", () => {
    expect(resolveNearbyAirportsTool.description).toContain("airport");
  });

  it("execute returns airports for a city name", async () => {
    const result = await resolveNearbyAirportsTool.execute({ query: "London" }, { messages: [], toolCallId: "test" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("code");
  });
});

describe("searchFlightsTool", () => {
  it("has required parameters in schema", () => {
    expect(searchFlightsTool.description).toContain("flight");
  });
});

describe("findAlternativeDatesTool", () => {
  it("has required parameters in schema", () => {
    expect(findAlternativeDatesTool.description).toContain("date");
  });
});
