import type { FlightResult } from "./types";

interface FilterOptions { excludedAirports?: string[]; maxStops?: number; }

export function filterFlights(flights: FlightResult[], options: FilterOptions): FlightResult[] {
  const { excludedAirports = [], maxStops } = options;
  const excludedSet = new Set(excludedAirports.map((a) => a.toUpperCase()));
  return flights
    .filter((f) => {
      if (excludedSet.size > 0 && f.layovers.some((l) => excludedSet.has(l.airport.toUpperCase()))) return false;
      if (maxStops !== undefined && f.stops > maxStops) return false;
      return true;
    })
    .sort((a, b) => a.price - b.price);
}
