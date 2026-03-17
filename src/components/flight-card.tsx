import type { FlightResult } from "@/lib/types";

interface FlightCardProps {
  flight: FlightResult;
  isCheapest?: boolean;
}

export function FlightCard({ flight, isCheapest }: FlightCardProps) {
  const hours = Math.floor(flight.duration_minutes / 60);
  const mins = flight.duration_minutes % 60;

  return (
    <div className={`relative p-4 rounded-lg border ${isCheapest ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"} hover:shadow-md transition-shadow`}>
      {isCheapest && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">CHEAPEST</span>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center justify-between sm:block sm:flex-1">
          <div className="flex items-center gap-2 text-base sm:text-lg font-semibold">
            <span>{formatTime(flight.departure_time)}</span>
            <span className="text-gray-400">—</span>
            <span>{formatTime(flight.arrival_time)}</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 sm:hidden">${flight.price}</div>
        </div>
        <div className="flex items-center sm:block sm:flex-1 sm:text-center gap-3">
          <div className="text-xs sm:text-sm text-gray-500">
            {flight.airline} &middot; {flight.flight_number}
            {flight.departure_date && <span className="ml-1 text-gray-400">{formatDate(flight.departure_date)}</span>}
          </div>
          <div className="text-xs text-gray-500">
            {hours}h{mins > 0 ? ` ${mins}m` : ""} &middot; {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            {flight.layovers.length > 0 && ` (${flight.layovers.map((l) => l.airport).join(", ")})`}
          </div>
        </div>
        <div className="flex items-center justify-between sm:block sm:text-right">
          <div className="hidden sm:block">
            <div className="text-2xl font-bold text-gray-900">${flight.price}</div>
            <div className="text-xs text-gray-500">{flight.currency}</div>
          </div>
          <a
            href={buildBookingUrl(flight)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Book →
          </a>
        </div>
      </div>
      {flight.layovers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex gap-4 text-xs text-gray-500">
            {flight.layovers.map((l, i) => (
              <span key={i}>{l.airport}: {Math.floor(l.duration_minutes / 60)}h {l.duration_minutes % 60}m layover</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(datetime: string): string {
  const timePart = datetime.split(" ")[1];
  if (!timePart) return datetime;
  return timePart.slice(0, 5);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function buildBookingUrl(flight: FlightResult): string {
  if (flight.google_flights_url) return flight.google_flights_url;
  const date = flight.departure_date || flight.departure_time.split(" ")[0];
  return `https://www.google.com/travel/flights?q=Flights+from+${flight.origin}+to+${flight.destination}+on+${date}+one+way`;
}
