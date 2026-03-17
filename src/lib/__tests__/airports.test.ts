import { describe, it, expect } from "vitest";
import { resolveAirports } from "../airports";

describe("resolveAirports", () => {
  it("finds exact IATA code match", () => {
    const results = resolveAirports("JFK");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("JFK");
  });

  it("finds airports by city name", () => {
    const results = resolveAirports("London");
    const codes = results.map((r) => r.code);
    expect(codes).toContain("LHR");
  });

  it("finds nearby airports for a region", () => {
    const results = resolveAirports("New York");
    const codes = results.map((r) => r.code);
    expect(codes).toContain("JFK");
    expect(codes).toContain("EWR");
  });

  it("returns empty array for nonsense input", () => {
    const results = resolveAirports("xyzzy12345");
    expect(results).toEqual([]);
  });
});
