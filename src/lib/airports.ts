import Fuse from "fuse.js";
import airportData from "./airports.json";

interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}

const fuse = new Fuse(airportData as Airport[], {
  keys: ["code", "name", "city"],
  threshold: 0.3,
  includeScore: true,
});

export function resolveAirports(query: string): Airport[] {
  // Exact IATA match first
  const exact = (airportData as Airport[]).filter(
    (a) => a.code.toUpperCase() === query.toUpperCase()
  );
  if (exact.length > 0) return exact;

  // Fuzzy search
  const results = fuse.search(query, { limit: 10 });
  return results.map((r) => r.item);
}
