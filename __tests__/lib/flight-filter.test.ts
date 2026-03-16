import { describe, it, expect } from "vitest";
import { filterFlights } from "@/lib/flight-filter";
import type { FlightResult } from "@/lib/types";

const makeFlightWithLayover = (airport: string, price: number): FlightResult => ({
  airline: "Test Air", flight_number: "TA 123", departure_time: "2026-03-25 07:00", arrival_time: "2026-03-25 18:00",
  duration_minutes: 660, origin: "SZX", destination: "LHR", stops: 1,
  layovers: [{ airport, city: "Test City", country: "", duration_minutes: 120 }],
  price, currency: "USD", cabin_class: "economy",
});

const directFlight: FlightResult = {
  airline: "Direct Air", flight_number: "DA 1", departure_time: "2026-03-25 13:00", arrival_time: "2026-03-25 20:00",
  duration_minutes: 780, origin: "SZX", destination: "LHR", stops: 0, layovers: [], price: 500, currency: "USD", cabin_class: "economy",
};

describe("filterFlights", () => {
  it("excludes flights with stopovers at excluded airports", () => {
    const flights = [makeFlightWithLayover("DXB", 300), makeFlightWithLayover("PVG", 330), directFlight];
    const result = filterFlights(flights, { excludedAirports: ["DXB", "AUH"] });
    expect(result).toHaveLength(2);
    expect(result[0].layovers[0]?.airport).toBe("PVG");
  });
  it("returns all flights when no exclusions", () => {
    expect(filterFlights([makeFlightWithLayover("DXB", 300), makeFlightWithLayover("PVG", 330)], {})).toHaveLength(2);
  });
  it("sorts by price ascending", () => {
    const r = filterFlights([makeFlightWithLayover("PVG", 500), makeFlightWithLayover("PEK", 200), makeFlightWithLayover("CAN", 350)], {});
    expect(r[0].price).toBe(200); expect(r[1].price).toBe(350); expect(r[2].price).toBe(500);
  });
  it("respects max stops filter", () => {
    const r = filterFlights([makeFlightWithLayover("PVG", 300), directFlight], { maxStops: 0 });
    expect(r).toHaveLength(1); expect(r[0].stops).toBe(0);
  });
});
