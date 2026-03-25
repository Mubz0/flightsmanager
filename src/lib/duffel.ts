import { Duffel } from "@duffel/api";
import { LRUCache } from "lru-cache";
import type { FlightResult, Layover } from "./types";

const duffelCache = new LRUCache<string, FlightResult[]>({
  max: 200,
  ttl: 5 * 60 * 1000, // 5 minutes
});

function getDuffelClient(): Duffel {
  const token = process.env.DUFFEL_API_KEY;
  if (!token) throw new Error("DUFFEL_API_KEY not configured");
  return new Duffel({ token });
}

const CABIN_CLASS_MAP: Record<string, "economy" | "premium_economy" | "business" | "first"> = {
  economy: "economy",
  premium_economy: "premium_economy",
  business: "business",
  first: "first",
};

export async function searchFlightsDuffel(
  origin: string,
  destination: string,
  date: string,
  cabinClass?: string,
  returnDate?: string,
  currency = "USD"
): Promise<FlightResult[]> {
  const cacheKey = `duffel-${origin}-${destination}-${date}-${returnDate || "oneway"}-${cabinClass || "economy"}-${currency}`;
  const cached = duffelCache.get(cacheKey);
  if (cached) return cached;

  const duffel = getDuffelClient();

  const slices = [
    { origin, destination, departure_date: date, arrival_time: null, departure_time: null },
    ...(returnDate ? [{ origin: destination, destination: origin, departure_date: returnDate, arrival_time: null, departure_time: null }] : []),
  ];

  const cabin = CABIN_CLASS_MAP[cabinClass || "economy"] || "economy";

  const offerRequest = await duffel.offerRequests.create({
    slices,
    passengers: [{ type: "adult" }],
    cabin_class: cabin,
    return_offers: false,
  });

  const requestId = offerRequest.data.id;

  // Fetch offers for this request
  const offersResponse = await duffel.offers.list({
    offer_request_id: requestId,
    sort: "total_amount",
    max_connections: 2,
  });

  const isRoundTrip = !!returnDate;
  const results: FlightResult[] = [];

  for (const offer of offersResponse.data) {
    try {
      const totalAmount = parseFloat(offer.total_amount);
      if (isNaN(totalAmount) || totalAmount <= 0) continue;

      // Use the first slice for departure info
      const slice = offer.slices[0];
      if (!slice || slice.segments.length === 0) continue;

      const firstSeg = slice.segments[0];
      const lastSeg = slice.segments[slice.segments.length - 1];

      // Build layovers from intermediate segments
      const layovers: Layover[] = slice.segments.slice(0, -1).map((seg) => ({
        airport: seg.destination.iata_code ?? "",
        city: seg.destination.city_name ?? seg.destination.iata_code ?? "",
        country: "",
        duration_minutes: 0,
      }));

      const stops = slice.segments.length - 1;
      const durationMinutes = Math.round(slice.duration ? parseDuration(slice.duration) : 0);

      // Show marketing carrier if different from operating
      const marketingCarrier = firstSeg.marketing_carrier;
      const operatingCarrier = firstSeg.operating_carrier;
      const airlineName = marketingCarrier?.name || operatingCarrier?.name || "Unknown";
      const flightNumber = `${marketingCarrier?.iata_code || ""}${firstSeg.marketing_carrier_flight_number || ""}`;

      results.push({
        airline: airlineName,
        flight_number: flightNumber,
        departure_time: firstSeg.departing_at ?? "",
        arrival_time: lastSeg.arriving_at ?? "",
        duration_minutes: durationMinutes,
        origin: firstSeg.origin.iata_code ?? "",
        destination: lastSeg.destination.iata_code ?? "",
        stops,
        layovers,
        price: totalAmount,
        currency: offer.total_currency ?? currency,
        cabin_class: cabin,
        departure_date: date,
        trip_type: isRoundTrip ? "round_trip" : "one_way",
      });
    } catch {
      // skip malformed offers
    }
  }

  // Sort by price
  results.sort((a, b) => a.price - b.price);

  duffelCache.set(cacheKey, results);
  return results;
}

// Parse ISO 8601 duration (e.g. PT14H30M) to minutes
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const mins = parseInt(match[2] || "0", 10);
  return hours * 60 + mins;
}
