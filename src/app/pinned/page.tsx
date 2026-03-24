"use client";

import { usePins } from "@/components/pin-context";
import type { FlightResult } from "@/lib/types";
import type { HotelResult } from "@/lib/types-hotels";

export default function PinnedPage() {
  const { pinnedFlights, pinnedHotels, unpinFlight, unpinHotel, clear, totalPinned } = usePins();

  if (totalPinned === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-20">
        <PinEmptyIcon />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No pinned flights or hotels yet.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Pin items from search results to compare them here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Compare ({totalPinned})</h2>
        <button onClick={clear} className="text-xs text-red-500 hover:text-red-700 font-medium">
          Clear all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pinnedFlights.length > 0 && (
          <section>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Flights</div>
            <div className="space-y-2">
              {pinnedFlights.map((f, i) => (
                <PinnedFlightCard key={`f-${i}`} flight={f} onRemove={() => unpinFlight(i)} />
              ))}
              {pinnedFlights.length >= 2 && <FlightComparisonSummary flights={pinnedFlights} />}
            </div>
          </section>
        )}

        {pinnedHotels.length > 0 && (
          <section className={pinnedFlights.length > 0 ? "mt-4" : ""}>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Hotels</div>
            <div className="space-y-2">
              {pinnedHotels.map((h, i) => (
                <PinnedHotelCard key={`h-${i}`} hotel={h} onRemove={() => unpinHotel(i)} />
              ))}
              {pinnedHotels.length >= 2 && <HotelComparisonSummary hotels={pinnedHotels} />}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PinnedFlightCard({ flight, onRemove }: { flight: FlightResult; onRemove: () => void }) {
  const hours = Math.floor(flight.duration_minutes / 60);
  const mins = flight.duration_minutes % 60;
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-gray-100">
          {flight.airline} {flight.flight_number}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatTime(flight.departure_time)} — {formatTime(flight.arrival_time)} · {hours}h{mins > 0 ? `${mins}m` : ""}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
          {flight.layovers.length > 0 && ` (${flight.layovers.map((l) => l.airport).join(", ")})`}
        </div>
      </div>
      <div className="text-right ml-3 shrink-0">
        <div className="font-bold text-gray-900 dark:text-gray-100">${flight.price}</div>
        {flight.trip_type === "round_trip" && <div className="text-[10px] text-gray-400">round-trip</div>}
      </div>
      <button onClick={onRemove} className="ml-3 p-1 text-gray-300 hover:text-red-500 text-xl leading-none shrink-0">&times;</button>
    </div>
  );
}

function PinnedHotelCard({ hotel, onRemove }: { hotel: HotelResult; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{hotel.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {hotel.hotelClass > 0 && `${"★".repeat(hotel.hotelClass)} · `}
          {hotel.overallRating > 0 && `${hotel.overallRating.toFixed(1)} rating · `}
          {hotel.checkIn} → {hotel.checkOut}
        </div>
      </div>
      <div className="text-right ml-3 shrink-0">
        <div className="font-bold text-gray-900 dark:text-gray-100">${hotel.pricePerNight}</div>
        <div className="text-[10px] text-gray-400">/night</div>
      </div>
      <button onClick={onRemove} className="ml-3 p-1 text-gray-300 hover:text-red-500 text-xl leading-none shrink-0">&times;</button>
    </div>
  );
}

function FlightComparisonSummary({ flights }: { flights: FlightResult[] }) {
  const cheapest = flights.reduce((a, b) => (a.price < b.price ? a : b));
  const fastest = flights.reduce((a, b) => (a.duration_minutes < b.duration_minutes ? a : b));
  return (
    <div className="mt-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs">
      <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Flight comparison</div>
      <div className="text-blue-700 dark:text-blue-300">Cheapest: {cheapest.airline} ${cheapest.price}</div>
      <div className="text-blue-700 dark:text-blue-300">
        Fastest: {fastest.airline} {Math.floor(fastest.duration_minutes / 60)}h
        {fastest.duration_minutes % 60 > 0 ? `${fastest.duration_minutes % 60}m` : ""}
      </div>
    </div>
  );
}

function HotelComparisonSummary({ hotels }: { hotels: HotelResult[] }) {
  const cheapest = hotels.reduce((a, b) => (a.pricePerNight < b.pricePerNight ? a : b));
  const bestRated = hotels.reduce((a, b) => (a.overallRating > b.overallRating ? a : b));
  return (
    <div className="mt-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs">
      <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Hotel comparison</div>
      <div className="text-blue-700 dark:text-blue-300">Cheapest: {cheapest.name} ${cheapest.pricePerNight}/night</div>
      <div className="text-blue-700 dark:text-blue-300">Best rated: {bestRated.name} {bestRated.overallRating.toFixed(1)}</div>
    </div>
  );
}

function formatTime(datetime: string): string {
  const timePart = datetime.split(" ")[1];
  if (!timePart) return datetime;
  return timePart.slice(0, 5);
}

function PinEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
    </svg>
  );
}
