import type { LegSearchResult } from "@/lib/types";
import { FlightCard } from "./flight-card";

interface FlightResultsProps {
  legResults: LegSearchResult[];
  summary: string | null;
}

export function FlightResults({ legResults, summary }: FlightResultsProps) {
  if (legResults.length === 0) return null;
  return (
    <div className="space-y-8">
      {summary && (
        <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">AI Summary</h3>
          <p className="text-sm text-purple-700">{summary}</p>
        </div>
      )}
      {legResults.map((legResult, legIndex) => (
        <div key={legIndex}>
          <h3 className="text-lg font-semibold mb-3">
            {legResult.leg.origin} → {legResult.leg.destination}
            <span className="text-sm font-normal text-gray-500 ml-2">
              {legResult.leg.date}
              {legResult.cheapest_price !== null && ` · from $${legResult.cheapest_price}`}
            </span>
          </h3>
          {legResult.error && <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{legResult.error}</div>}
          {legResult.flights.length === 0 && !legResult.error && (
            <div className="p-3 rounded bg-yellow-50 text-yellow-700 text-sm">No flights found for this leg.</div>
          )}
          <div className="space-y-3">
            {legResult.flights.slice(0, 5).map((flight, i) => (
              <FlightCard key={i} flight={flight} isCheapest={i === 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
