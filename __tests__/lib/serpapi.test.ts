import { describe, it, expect } from "vitest";
import { normalizeSerpApiResponse, buildSerpApiUrl } from "@/lib/serpapi";

describe("serpapi", () => {
  describe("buildSerpApiUrl", () => {
    it("builds correct URL for one-way flight", () => {
      const url = buildSerpApiUrl({ origin: "SZX", destination: "LHR", date: "2026-03-25", apiKey: "test-key" });
      expect(url).toContain("engine=google_flights");
      expect(url).toContain("departure_id=SZX");
      expect(url).toContain("arrival_id=LHR");
      expect(url).toContain("outbound_date=2026-03-25");
      expect(url).toContain("type=2");
      expect(url).toContain("api_key=test-key");
    });
  });
  describe("normalizeSerpApiResponse", () => {
    it("normalizes a flight from SerpApi response", () => {
      const data = {
        best_flights: [{
          flights: [
            { airline: "China Eastern", flight_number: "MU 504", departure_airport: { id: "SZX", time: "2026-03-25 07:15" }, arrival_airport: { id: "PVG", time: "2026-03-25 09:45" }, duration: 150 },
            { airline: "China Eastern", flight_number: "MU 551", departure_airport: { id: "PVG", time: "2026-03-25 13:15" }, arrival_airport: { id: "LHR", time: "2026-03-25 18:40" }, duration: 745 },
          ],
          layovers: [{ name: "Shanghai Pudong", id: "PVG", duration: 210 }],
          total_duration: 1105, price: 330, carbon_emissions: { this_flight: 813000 },
        }],
        other_flights: [],
      };
      const results = normalizeSerpApiResponse(data, "USD");
      expect(results).toHaveLength(1);
      expect(results[0].airline).toBe("China Eastern");
      expect(results[0].price).toBe(330);
      expect(results[0].origin).toBe("SZX");
      expect(results[0].destination).toBe("LHR");
      expect(results[0].stops).toBe(1);
      expect(results[0].layovers[0].airport).toBe("PVG");
      expect(results[0].layovers[0].duration_minutes).toBe(210);
    });
    it("returns empty array for no flights", () => {
      expect(normalizeSerpApiResponse({ best_flights: [], other_flights: [] }, "USD")).toEqual([]);
    });
  });
});
