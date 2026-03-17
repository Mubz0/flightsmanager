"use client";

import { useState } from "react";
import type { FlightResult } from "@/lib/types";
import type { HotelResult } from "@/lib/types-hotels";

interface PinnedDrawerProps {
  flights: FlightResult[];
  hotels: HotelResult[];
  onRemoveFlight: (index: number) => void;
  onRemoveHotel: (index: number) => void;
  onClear: () => void;
  totalPinned: number;
}

export function PinnedFlightsDrawer({ flights, hotels, onRemoveFlight, onRemoveHotel, onClear, totalPinned }: PinnedDrawerProps) {
  const [open, setOpen] = useState(false);

  if (totalPinned === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        <span>{totalPinned} pinned</span>
        <span>{open ? "▼" : "▲"}</span>
      </button>

      {open && (
        <div className="fixed bottom-32 right-4 z-50 w-[90vw] sm:w-[420px] max-h-[60vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Compare</span>
            <div className="flex gap-2">
              <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
              <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(60vh-40px)] p-3 space-y-2">
            {flights.length > 0 && (
              <>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Flights</div>
                {flights.map((f, i) => (
                  <PinnedFlightCard key={`f-${i}`} flight={f} onRemove={() => onRemoveFlight(i)} />
                ))}
                {flights.length >= 2 && <FlightComparisonSummary flights={flights} />}
              </>
            )}
            {hotels.length > 0 && (
              <>
                <div className={`text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide ${flights.length > 0 ? "mt-3" : ""}`}>Hotels</div>
                {hotels.map((h, i) => (
                  <PinnedHotelCard key={`h-${i}`} hotel={h} onRemove={() => onRemoveHotel(i)} />
                ))}
                {hotels.length >= 2 && <HotelComparisonSummary hotels={hotels} />}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PinnedFlightCard({ flight, onRemove }: { flight: FlightResult; onRemove: () => void }) {
  const hours = Math.floor(flight.duration_minutes / 60);
  const mins = flight.duration_minutes % 60;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-gray-100">
          {flight.airline} {flight.flight_number}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatTime(flight.departure_time)} — {formatTime(flight.arrival_time)} &middot; {hours}h{mins > 0 ? `${mins}m` : ""}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
          {flight.layovers.length > 0 && ` (${flight.layovers.map(l => l.airport).join(", ")})`}
        </div>
      </div>
      <div className="text-right ml-3">
        <div className="font-bold text-gray-900 dark:text-gray-100">${flight.price}</div>
        {flight.trip_type === "round_trip" && <div className="text-[10px] text-gray-400">round-trip</div>}
      </div>
      <button onClick={onRemove} className="ml-2 text-gray-300 hover:text-red-500 text-lg leading-none">&times;</button>
    </div>
  );
}

function PinnedHotelCard({ hotel, onRemove }: { hotel: HotelResult; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{hotel.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {hotel.hotelClass > 0 && `${"★".repeat(hotel.hotelClass)} · `}
          {hotel.overallRating > 0 && `${hotel.overallRating.toFixed(1)} rating · `}
          {hotel.checkIn} → {hotel.checkOut}
        </div>
      </div>
      <div className="text-right ml-3">
        <div className="font-bold text-gray-900 dark:text-gray-100">${hotel.pricePerNight}</div>
        <div className="text-[10px] text-gray-400">/night</div>
      </div>
      <button onClick={onRemove} className="ml-2 text-gray-300 hover:text-red-500 text-lg leading-none">&times;</button>
    </div>
  );
}

function FlightComparisonSummary({ flights }: { flights: FlightResult[] }) {
  const cheapest = flights.reduce((a, b) => a.price < b.price ? a : b);
  const fastest = flights.reduce((a, b) => a.duration_minutes < b.duration_minutes ? a : b);
  return (
    <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs">
      <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Flight comparison</div>
      <div className="text-blue-700 dark:text-blue-300">
        Cheapest: {cheapest.airline} ${cheapest.price}
      </div>
      <div className="text-blue-700 dark:text-blue-300">
        Fastest: {fastest.airline} {Math.floor(fastest.duration_minutes / 60)}h{fastest.duration_minutes % 60 > 0 ? `${fastest.duration_minutes % 60}m` : ""}
      </div>
    </div>
  );
}

function HotelComparisonSummary({ hotels }: { hotels: HotelResult[] }) {
  const cheapest = hotels.reduce((a, b) => a.pricePerNight < b.pricePerNight ? a : b);
  const bestRated = hotels.reduce((a, b) => a.overallRating > b.overallRating ? a : b);
  return (
    <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs">
      <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Hotel comparison</div>
      <div className="text-blue-700 dark:text-blue-300">
        Cheapest: {cheapest.name} ${cheapest.pricePerNight}/night
      </div>
      <div className="text-blue-700 dark:text-blue-300">
        Best rated: {bestRated.name} {bestRated.overallRating.toFixed(1)}
      </div>
    </div>
  );
}

function formatTime(datetime: string): string {
  const timePart = datetime.split(" ")[1];
  if (!timePart) return datetime;
  return timePart.slice(0, 5);
}
