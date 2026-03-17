import { LRUCache } from "lru-cache";
import type { FlightResult, Layover } from "./types";
import { expandCityCode } from "./city-codes";

// Cache SerpApi results for 30 minutes, max 200 entries
const flightCache = new LRUCache<string, SearchResult>({
  max: 200,
  ttl: 30 * 60 * 1000, // 30 minutes
});

interface BuildUrlParams { origin: string; destination: string; date: string; apiKey: string; cabinClass?: string; returnDate?: string; currency?: string; }

export function buildSerpApiUrl(params: BuildUrlParams): string {
  const { origin, destination, date, apiKey, cabinClass, returnDate, currency = "USD" } = params;
  const type = returnDate ? "1" : "2"; // 1 = round-trip, 2 = one-way
  const sp = new URLSearchParams({ engine: "google_flights", departure_id: origin, arrival_id: destination, outbound_date: date, type, currency, hl: "en", api_key: apiKey });
  if (returnDate) sp.set("return_date", returnDate);
  if (cabinClass) { const m: Record<string,string> = { economy: "1", premium_economy: "2", business: "3", first: "4" }; sp.set("travel_class", m[cabinClass] || "1"); }
  return `https://serpapi.com/search?${sp.toString()}`;
}

interface SerpApiFlight { flights: Array<{ airline: string; flight_number: string; departure_airport: { id: string; time: string }; arrival_airport: { id: string; time: string }; duration: number }>; layovers?: Array<{ name: string; id: string; duration: number }>; total_duration: number; price: number; carbon_emissions?: { this_flight: number }; booking_token?: string; }
interface SerpApiPriceInsights { lowest_price?: number; price_level?: string; typical_price_range?: [number, number]; price_history?: number[][]; }
interface SerpApiResponse { best_flights: SerpApiFlight[]; other_flights: SerpApiFlight[]; search_metadata?: { google_flights_url?: string }; price_insights?: SerpApiPriceInsights; }

export interface PriceInsights { lowest_price?: number; price_level?: string; typical_price_range?: [number, number]; }

export function extractPriceInsights(data: SerpApiResponse): PriceInsights | null {
  const pi = data.price_insights;
  if (!pi) return null;
  return {
    lowest_price: pi.lowest_price,
    price_level: pi.price_level,
    typical_price_range: pi.typical_price_range,
  };
}

export interface SearchResult { flights: FlightResult[]; priceInsights: PriceInsights | null; }

export function normalizeSerpApiResponse(data: SerpApiResponse, currency: string, isRoundTrip = false): FlightResult[] {
  const all = [...(data.best_flights || []), ...(data.other_flights || [])];
  const googleFlightsUrl = data.search_metadata?.google_flights_url;
  return all.filter((f) => typeof f.price === "number" && f.price > 0).map((f) => {
    const first = f.flights[0], last = f.flights[f.flights.length - 1];
    const layovers: Layover[] = (f.layovers || []).map((l) => ({ airport: l.id, city: l.name, country: "", duration_minutes: l.duration }));
    const depDate = first.departure_airport.time.split(" ")[0];
    return { airline: first.airline, flight_number: first.flight_number, departure_time: first.departure_airport.time, arrival_time: last.arrival_airport.time, duration_minutes: f.total_duration, origin: first.departure_airport.id, destination: last.arrival_airport.id, stops: f.flights.length - 1, layovers, price: f.price, currency, cabin_class: "economy", co2_emissions_kg: f.carbon_emissions ? Math.round(f.carbon_emissions.this_flight / 1000) : undefined, booking_token: f.booking_token, departure_date: depDate, google_flights_url: googleFlightsUrl, trip_type: isRoundTrip ? "round_trip" : "one_way" };
  });
}

async function searchSingleRoute(origin: string, destination: string, date: string, apiKey: string, cabinClass?: string, returnDate?: string, currency = "USD"): Promise<SearchResult> {
  const cacheKey = `${origin}-${destination}-${date}-${returnDate || "oneway"}-${cabinClass || "economy"}-${currency}`;
  const cached = flightCache.get(cacheKey);
  if (cached) return cached;

  const url = buildSerpApiUrl({ origin, destination, date, apiKey, cabinClass, returnDate, currency });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`SerpApi request failed: ${r.status} ${r.statusText}`);
  const data = await r.json();
  const result: SearchResult = {
    flights: normalizeSerpApiResponse(data, currency, !!returnDate),
    priceInsights: extractPriceInsights(data),
  };

  flightCache.set(cacheKey, result);
  return result;
}

export async function searchFlights(origin: string, destination: string, date: string, apiKey: string, cabinClass?: string, returnDate?: string, currency = "USD"): Promise<SearchResult> {
  // Expand multi-airport city codes (e.g. LON → LHR, LGW, STN, ...)
  const originCodes = expandCityCode(origin) || [origin];
  const destCodes = expandCityCode(destination) || [destination];

  // If no expansion needed, do a single search
  if (originCodes.length === 1 && destCodes.length === 1) {
    return searchSingleRoute(originCodes[0], destCodes[0], date, apiKey, cabinClass, returnDate, currency);
  }

  // Search all origin×destination combinations in parallel
  const pairs: Array<[string, string]> = [];
  for (const o of originCodes) {
    for (const d of destCodes) {
      pairs.push([o, d]);
    }
  }

  const settled = await Promise.allSettled(
    pairs.map(([o, d]) => searchSingleRoute(o, d, date, apiKey, cabinClass, returnDate, currency))
  );

  const allFlights: FlightResult[] = [];
  let bestInsights: PriceInsights | null = null;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allFlights.push(...result.value.flights);
      if (!bestInsights && result.value.priceInsights) {
        bestInsights = result.value.priceInsights;
      }
    }
  }

  // Sort by price and deduplicate by flight number + date
  allFlights.sort((a, b) => a.price - b.price);

  return { flights: allFlights, priceInsights: bestInsights };
}
