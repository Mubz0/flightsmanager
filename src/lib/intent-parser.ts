import type { FlightSearchIntent } from "./types";

export const FLIGHT_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "search_flights",
    description: "Search for flights based on the user's travel request. Convert all city names to IATA airport codes. Convert vague dates like 'late March' to a specific date with date_flexibility.",
    parameters: {
      type: "object",
      properties: {
        legs: { type: "array", description: "Individual flight legs to search", items: { type: "object", properties: { origin: { type: "string", description: "Origin IATA airport code" }, destination: { type: "string", description: "Destination IATA airport code" }, date: { type: "string", description: "Departure date YYYY-MM-DD" }, date_flexibility: { type: "number", description: "Days +/- to search" } }, required: ["origin", "destination", "date"] } },
        excluded_stopover_airports: { type: "array", items: { type: "string" }, description: "IATA codes to exclude as stopovers" },
        excluded_stopover_countries: { type: "array", items: { type: "string" }, description: "Countries to exclude" },
        cabin_class: { type: "string", enum: ["economy", "premium_economy", "business", "first"] },
        max_stops: { type: "number" },
        preferred_airlines: { type: "array", items: { type: "string" } },
      },
      required: ["legs"],
    },
  },
} as const;

export function parseIntentFromToolCall(argsJson: string): FlightSearchIntent {
  let parsed: unknown;
  try { parsed = JSON.parse(argsJson); } catch { throw new Error(`Invalid JSON in tool call arguments: ${argsJson}`); }
  const obj = parsed as Record<string, unknown>;
  if (!obj.legs || !Array.isArray(obj.legs) || obj.legs.length === 0) {
    throw new Error("Tool call must include at least one flight leg in 'legs'");
  }
  return obj as unknown as FlightSearchIntent;
}
