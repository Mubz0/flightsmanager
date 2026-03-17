export interface FlightSearchIntent {
  legs: FlightLeg[];
  excluded_stopover_airports?: string[];
  excluded_stopover_countries?: string[];
  cabin_class?: "economy" | "premium_economy" | "business" | "first";
  max_stops?: number;
  preferred_airlines?: string[];
}

export interface FlightLeg {
  origin: string; // IATA code
  destination: string; // IATA code
  date: string; // YYYY-MM-DD
  date_flexibility?: number; // days ± to search
}

export interface FlightResult {
  airline: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  origin: string; // IATA code
  destination: string; // IATA code
  stops: number;
  layovers: Layover[];
  price: number;
  currency: string;
  cabin_class: string;
  co2_emissions_kg?: number;
  booking_token?: string;
  departure_date?: string;
  google_flights_url?: string;
}

export interface Layover {
  airport: string; // IATA code
  city: string;
  country: string;
  duration_minutes: number;
}

export interface LegSearchResult {
  leg: FlightLeg;
  flights: FlightResult[];
  cheapest_price: number | null;
  error?: string;
}

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "leg_result"; data: LegSearchResult }
  | { type: "summary"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
