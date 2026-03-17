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
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>{formatTime(flight.departure_time)}</span>
            <span className="text-gray-400">—</span>
            <span>{formatTime(flight.arrival_time)}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">{flight.airline} &middot; {flight.flight_number}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-medium">{hours}h {mins > 0 ? `${mins}m` : ""}</div>
          <div className="flex items-center justify-center gap-1 my-1">
            <div className="h-px w-16 bg-gray-300" />
            {flight.stops > 0 && <div className="h-2 w-2 rounded-full bg-gray-400" />}
            <div className="h-px w-16 bg-gray-300" />
          </div>
          <div className="text-xs text-gray-500">
            {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            {flight.layovers.length > 0 && ` (${flight.layovers.map((l) => l.airport).join(", ")})`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">${flight.price}</div>
          <div className="text-xs text-gray-500">{flight.currency}</div>
          <a
            href={buildBookingUrl(flight)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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

function buildBookingUrl(flight: FlightResult): string {
  const date = flight.departure_date || flight.departure_time.split(" ")[0];
  return `https://www.kiwi.com/en/search/results/${flight.origin}/${flight.destination}/${date}/no-return?sortBy=price`;
}
