import { LRUCache } from "lru-cache";
import type { FlightResult, Layover } from "./types";

// Cache SerpApi results for 30 minutes, max 200 entries
const flightCache = new LRUCache<string, FlightResult[]>({
  max: 200,
  ttl: 30 * 60 * 1000, // 30 minutes
});

interface BuildUrlParams { origin: string; destination: string; date: string; apiKey: string; cabinClass?: string; }

export function buildSerpApiUrl(params: BuildUrlParams): string {
  const { origin, destination, date, apiKey, cabinClass } = params;
  const sp = new URLSearchParams({ engine: "google_flights", departure_id: origin, arrival_id: destination, outbound_date: date, type: "2", currency: "USD", hl: "en", api_key: apiKey });
  if (cabinClass) { const m: Record<string,string> = { economy: "1", premium_economy: "2", business: "3", first: "4" }; sp.set("travel_class", m[cabinClass] || "1"); }
  return `https://serpapi.com/search?${sp.toString()}`;
}

interface SerpApiFlight { flights: Array<{ airline: string; flight_number: string; departure_airport: { id: string; time: string }; arrival_airport: { id: string; time: string }; duration: number }>; layovers?: Array<{ name: string; id: string; duration: number }>; total_duration: number; price: number; carbon_emissions?: { this_flight: number }; booking_token?: string; }
interface SerpApiResponse { best_flights: SerpApiFlight[]; other_flights: SerpApiFlight[]; search_metadata?: { google_flights_url?: string }; }

export function normalizeSerpApiResponse(data: SerpApiResponse, currency: string): FlightResult[] {
  const all = [...(data.best_flights || []), ...(data.other_flights || [])];
  const googleFlightsUrl = data.search_metadata?.google_flights_url;
  return all.filter((f) => typeof f.price === "number" && f.price > 0).map((f) => {
    const first = f.flights[0], last = f.flights[f.flights.length - 1];
    const layovers: Layover[] = (f.layovers || []).map((l) => ({ airport: l.id, city: l.name, country: "", duration_minutes: l.duration }));
    const depDate = first.departure_airport.time.split(" ")[0];
    return { airline: first.airline, flight_number: first.flight_number, departure_time: first.departure_airport.time, arrival_time: last.arrival_airport.time, duration_minutes: f.total_duration, origin: first.departure_airport.id, destination: last.arrival_airport.id, stops: f.flights.length - 1, layovers, price: f.price, currency, cabin_class: "economy", co2_emissions_kg: f.carbon_emissions ? Math.round(f.carbon_emissions.this_flight / 1000) : undefined, booking_token: f.booking_token, departure_date: depDate, google_flights_url: googleFlightsUrl };
  });
}

export async function searchFlights(origin: string, destination: string, date: string, apiKey: string, cabinClass?: string): Promise<FlightResult[]> {
  const cacheKey = `${origin}-${destination}-${date}-${cabinClass || "economy"}`;
  const cached = flightCache.get(cacheKey);
  if (cached) return cached;

  const url = buildSerpApiUrl({ origin, destination, date, apiKey, cabinClass });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`SerpApi request failed: ${r.status} ${r.statusText}`);
  const results = normalizeSerpApiResponse(await r.json(), "USD");

  flightCache.set(cacheKey, results);
  return results;
}
