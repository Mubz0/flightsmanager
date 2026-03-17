"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { FlightResult } from "@/lib/types";

interface PinContextType {
  pinned: FlightResult[];
  pin: (flight: FlightResult) => void;
  unpin: (index: number) => void;
  isPinned: (flight: FlightResult) => boolean;
  clear: () => void;
}

const PinContext = createContext<PinContextType>({
  pinned: [],
  pin: () => {},
  unpin: () => {},
  isPinned: () => false,
  clear: () => {},
});

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState<FlightResult[]>([]);

  const pin = useCallback((flight: FlightResult) => {
    setPinned((prev) => {
      const exists = prev.some((f) => f.flight_number === flight.flight_number && f.departure_time === flight.departure_time && f.price === flight.price);
      if (exists) return prev;
      return [...prev, flight];
    });
  }, []);

  const unpin = useCallback((index: number) => {
    setPinned((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isPinned = useCallback((flight: FlightResult) => {
    return pinned.some((f) => f.flight_number === flight.flight_number && f.departure_time === flight.departure_time && f.price === flight.price);
  }, [pinned]);

  const clear = useCallback(() => setPinned([]), []);

  return (
    <PinContext.Provider value={{ pinned, pin, unpin, isPinned, clear }}>
      {children}
    </PinContext.Provider>
  );
}

export function usePins() {
  return useContext(PinContext);
}
