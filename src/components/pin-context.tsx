"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { FlightResult } from "@/lib/types";
import type { HotelResult } from "@/lib/types-hotels";

interface PinContextType {
  pinnedFlights: FlightResult[];
  pinnedHotels: HotelResult[];
  pinFlight: (flight: FlightResult) => void;
  unpinFlight: (index: number) => void;
  isFlightPinned: (flight: FlightResult) => boolean;
  pinHotel: (hotel: HotelResult) => void;
  unpinHotel: (index: number) => void;
  isHotelPinned: (hotel: HotelResult) => boolean;
  clear: () => void;
  totalPinned: number;
}

const PinContext = createContext<PinContextType>({
  pinnedFlights: [],
  pinnedHotels: [],
  pinFlight: () => {},
  unpinFlight: () => {},
  isFlightPinned: () => false,
  pinHotel: () => {},
  unpinHotel: () => {},
  isHotelPinned: () => false,
  clear: () => {},
  totalPinned: 0,
});

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [pinnedFlights, setPinnedFlights] = useState<FlightResult[]>([]);
  const [pinnedHotels, setPinnedHotels] = useState<HotelResult[]>([]);

  const pinFlight = useCallback((flight: FlightResult) => {
    setPinnedFlights((prev) => {
      const exists = prev.some((f) => f.flight_number === flight.flight_number && f.departure_time === flight.departure_time && f.price === flight.price);
      if (exists) return prev;
      return [...prev, flight];
    });
  }, []);

  const unpinFlight = useCallback((index: number) => {
    setPinnedFlights((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isFlightPinned = useCallback((flight: FlightResult) => {
    return pinnedFlights.some((f) => f.flight_number === flight.flight_number && f.departure_time === flight.departure_time && f.price === flight.price);
  }, [pinnedFlights]);

  const pinHotel = useCallback((hotel: HotelResult) => {
    setPinnedHotels((prev) => {
      const exists = prev.some((h) => h.name === hotel.name && h.checkIn === hotel.checkIn && h.pricePerNight === hotel.pricePerNight);
      if (exists) return prev;
      return [...prev, hotel];
    });
  }, []);

  const unpinHotel = useCallback((index: number) => {
    setPinnedHotels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isHotelPinned = useCallback((hotel: HotelResult) => {
    return pinnedHotels.some((h) => h.name === hotel.name && h.checkIn === hotel.checkIn && h.pricePerNight === hotel.pricePerNight);
  }, [pinnedHotels]);

  const clear = useCallback(() => {
    setPinnedFlights([]);
    setPinnedHotels([]);
  }, []);

  const totalPinned = pinnedFlights.length + pinnedHotels.length;

  return (
    <PinContext.Provider value={{ pinnedFlights, pinnedHotels, pinFlight, unpinFlight, isFlightPinned, pinHotel, unpinHotel, isHotelPinned, clear, totalPinned }}>
      {children}
    </PinContext.Provider>
  );
}

export function usePins() {
  return useContext(PinContext);
}
