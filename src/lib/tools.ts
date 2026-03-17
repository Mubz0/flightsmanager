import { z } from "zod";
import { tool } from "ai";
import { searchFlights } from "./serpapi";
import type { PriceInsights } from "./serpapi";
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
    trip_type: f.trip_type,
  }));
}

const searchFlightsSchema = z.object({
  origin: z.string().describe("Origin IATA airport code (e.g. JFK, BKK, LHR)"),
  destination: z.string().describe("Destination IATA airport code"),
  date: z.string().describe("Departure date in YYYY-MM-DD format"),
  returnDate: z.string().optional().describe("Return date in YYYY-MM-DD format. Include for round-trip searches, omit for one-way."),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional().describe("Cabin class"),
  maxStops: z.number().optional().describe("Maximum number of stops"),
  currency: z.string().optional().describe("Currency code (e.g. USD, EUR, GBP). Defaults to USD."),
  maxPrice: z.number().optional().describe("Maximum price. Filters out flights above this budget."),
  preferredAirlines: z.array(z.string()).optional().describe("Preferred airline names (e.g. ['Delta', 'United']). Results with these airlines are prioritized."),
  excludedAirlines: z.array(z.string()).optional().describe("Airline names to exclude (e.g. ['Spirit', 'Frontier'])."),
});

export const searchFlightsTool = tool({
  description: "Search for flights between two airports on a specific date. Supports one-way and round-trip. For round-trip, include returnDate — prices shown are total round-trip cost. Supports budget filtering (maxPrice), airline preferences, and airline exclusions. Returns up to 8 flight options sorted by price.",
  inputSchema: searchFlightsSchema,
  execute: async (input) => {
    const { origin, destination, date, returnDate, cabinClass, maxStops, maxPrice, preferredAirlines, excludedAirlines, currency } = input;
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return { status: "error", message: "SerpApi key not configured." };
    try {
      const { flights: allFlights, priceInsights } = await searchFlights(origin, destination, date, apiKey, cabinClass, returnDate, currency);
      let flights = allFlights;
      if (maxStops !== undefined) {
        flights = filterFlights(flights, { maxStops });
      }
      if (excludedAirlines?.length) {
        const excluded = excludedAirlines.map((a) => a.toLowerCase());
        flights = flights.filter((f) => !excluded.includes(f.airline.toLowerCase()));
      }
      const withinBudget = maxPrice ? flights.filter((f) => f.price <= maxPrice) : flights;
      const preferredMatches = preferredAirlines?.length
        ? withinBudget.filter((f) => preferredAirlines.some((a) => f.airline.toLowerCase().includes(a.toLowerCase())))
        : [];
      const otherFlights = preferredAirlines?.length
        ? withinBudget.filter((f) => !preferredAirlines.some((a) => f.airline.toLowerCase().includes(a.toLowerCase())))
        : withinBudget;
      const sorted = [...preferredMatches, ...otherFlights];

      if (sorted.length === 0) {
        const cheapest = flights.length > 0 ? flights[0].price : null;
        return {
          status: "no_results",
          message: `No flights match your criteria for ${origin} → ${destination} on ${date}.`,
          cheapest_available: cheapest,
          total_unfiltered: flights.length,
          filters_applied: { maxPrice, maxStops, preferredAirlines, excludedAirlines },
          price_insights: priceInsights,
          suggestions: [
            maxPrice && cheapest && cheapest > maxPrice ? `Cheapest available is $${cheapest} (over your $${maxPrice} budget). Consider increasing budget or trying adjacent dates.` : null,
            preferredAirlines?.length ? `No ${preferredAirlines.join("/")} flights found. Other airlines are available.` : null,
            flights.length === 0 ? "No flights at all on this route/date. Try different dates or nearby airports." : null,
          ].filter(Boolean),
        };
      }
      const result: any[] = pruneFlights(sorted);
      if (priceInsights) {
        result.push({ _price_insights: priceInsights });
      }
      return result;
    } catch (error) {
      return { status: "error", message: `Search failed for ${origin} → ${destination} on ${date}. Do not retry with the same parameters.`, suggestions: ["Try different dates", "Try nearby airports"] };
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
        if (result.status === "fulfilled" && result.value.flights.length > 0) {
          const validPrices = result.value.flights.map((f) => f.price).filter((p) => typeof p === "number" && !isNaN(p));
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

const exploreDestinationsSchema = z.object({
  origin: z.string().describe("Origin IATA airport code"),
  destinations: z.array(z.string()).min(2).max(5).describe("Array of destination IATA airport codes to compare (2-5)"),
  date: z.string().describe("Departure date in YYYY-MM-DD format"),
  returnDate: z.string().optional().describe("Return date for round-trip comparison"),
  currency: z.string().optional().describe("Currency code"),
});

export const exploreDestinationsTool = tool({
  description: "Compare flight prices to multiple destinations in parallel. Use when the user has a vague request like 'somewhere warm', 'where can I go for $500', or 'explore options from JFK'. You choose 2-5 candidate destination airports and this tool searches them all simultaneously, returning the cheapest flight to each.",
  inputSchema: exploreDestinationsSchema,
  execute: async (input) => {
    const { origin, destinations, date, returnDate, currency } = input;
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return { status: "error", message: "SerpApi key not configured." };

    const settled = await Promise.allSettled(
      destinations.map((dest) => searchFlights(origin, dest, date, apiKey, undefined, returnDate, currency))
    );

    const results: Array<{ destination: string; cheapest_price: number | null; airline?: string; duration_minutes?: number; stops?: number; currency: string }> = [];

    settled.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value.flights.length > 0) {
        const cheapest = result.value.flights[0];
        results.push({
          destination: destinations[i],
          cheapest_price: cheapest.price,
          airline: cheapest.airline,
          duration_minutes: cheapest.duration_minutes,
          stops: cheapest.stops,
          currency: cheapest.currency,
        });
      } else {
        results.push({ destination: destinations[i], cheapest_price: null, currency: currency || "USD" });
      }
    });

    results.sort((a, b) => (a.cheapest_price ?? Infinity) - (b.cheapest_price ?? Infinity));
    return results;
  },
});
