import { z } from "zod";
import { tool } from "ai";
import { searchFlights } from "./serpapi";
import { filterFlights } from "./flight-filter";
import { resolveAirports } from "./airports";
import type { FlightResult } from "./types";

function pruneFlights(flights: FlightResult[], max = 8) {
  return flights.slice(0, max).map((f) => ({
    airline: f.airline,
    flight_number: f.flight_number,
    departure_time: f.departure_time,
    arrival_time: f.arrival_time,
    duration_minutes: f.duration_minutes,
    stops: f.stops,
    layovers: f.layovers.map((l) => l.airport),
    price: f.price,
    currency: f.currency,
    departure_date: f.departure_date,
    google_flights_url: f.google_flights_url,
  }));
}

const searchFlightsSchema = z.object({
  origin: z.string().describe("Origin IATA airport code (e.g. JFK, BKK, LHR)"),
  destination: z.string().describe("Destination IATA airport code"),
  date: z.string().describe("Departure date in YYYY-MM-DD format"),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional().describe("Cabin class"),
  maxStops: z.number().optional().describe("Maximum number of stops"),
});

export const searchFlightsTool = tool({
  description: "Search for flights between two airports on a specific date. Returns up to 8 flight options sorted by price.",
  inputSchema: searchFlightsSchema,
  execute: async (input) => {
    const { origin, destination, date, cabinClass, maxStops } = input;
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return "SerpApi key not configured. Cannot search flights.";
    try {
      let flights = await searchFlights(origin, destination, date, apiKey, cabinClass);
      if (maxStops !== undefined) {
        flights = filterFlights(flights, { maxStops });
      }
      if (flights.length === 0) {
        return `No flights found for ${origin} → ${destination} on ${date}. Suggest the user try different dates or nearby airports.`;
      }
      return pruneFlights(flights);
    } catch (error) {
      return `Search failed for ${origin} → ${destination} on ${date}. Do not retry with the same parameters. Suggest the user try different dates.`;
    }
  },
});

const findAlternativeDatesSchema = z.object({
  origin: z.string().describe("Origin IATA airport code"),
  destination: z.string().describe("Destination IATA airport code"),
  baseDate: z.string().describe("Center date in YYYY-MM-DD format"),
  flexDays: z.number().min(1).max(3).describe("Number of days +/- to check (1-3)"),
});

export const findAlternativeDatesTool = tool({
  description: "Find the cheapest date to fly between two airports. Checks multiple dates around a base date and returns the cheapest price for each day.",
  inputSchema: findAlternativeDatesSchema,
  execute: async (input) => {
    const { origin, destination, baseDate, flexDays } = input;
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return "SerpApi key not configured.";
    try {
      const center = new Date(baseDate);
      const dates: string[] = [];
      for (let i = -flexDays; i <= flexDays; i++) {
        const d = new Date(center);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
      }
      const settled = await Promise.allSettled(
        dates.map((d) => searchFlights(origin, destination, d, apiKey))
      );
      const priceByDate: Record<string, number> = {};
      settled.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.length > 0) {
          const validPrices = result.value.map((f) => f.price).filter((p) => typeof p === "number" && !isNaN(p));
          if (validPrices.length > 0) {
            priceByDate[dates[i]] = Math.min(...validPrices);
          }
        }
      });
      if (Object.keys(priceByDate).length === 0) {
        return `No flights found for ${origin} → ${destination} around ${baseDate}. Suggest trying a different route.`;
      }
      return priceByDate;
    } catch (error) {
      return `Failed to check alternative dates for ${origin} → ${destination}. Suggest the user specify an exact date.`;
    }
  },
});

const resolveNearbyAirportsSchema = z.object({
  query: z.string().describe("City name, region, or airport name (e.g. 'London', 'New York', 'Napa Valley')"),
});

export const resolveNearbyAirportsTool = tool({
  description: "Find airport IATA codes for a city, region, or airport name. Use this when the user mentions a city name instead of an airport code.",
  inputSchema: resolveNearbyAirportsSchema,
  execute: async (input) => {
    const { query } = input;
    const results = resolveAirports(query);
    if (results.length === 0) {
      return `Could not find airports matching "${query}". Ask the user for a more specific airport or city name.`;
    }
    return results.slice(0, 5).map((a) => ({
      code: a.code,
      name: a.name,
      city: a.city,
    }));
  },
});
