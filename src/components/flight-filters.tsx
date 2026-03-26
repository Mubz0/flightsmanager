"use client";

import { useMemo } from "react";
import type { LegSearchResult } from "@/lib/types";

export interface FilterState {
  maxPrice: number | null;
  maxStops: number | null;
  airlines: Set<string>;
}

interface FlightFiltersProps {
  legResults: LegSearchResult[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function FlightFilters({ legResults, filters, onChange }: FlightFiltersProps) {
  const { allAirlines, priceRange } = useMemo(() => {
    const airlines = new Set<string>();
    let min = Infinity, max = 0;
    for (const leg of legResults) {
      for (const f of leg.flights) {
        airlines.add(f.airline);
        if (f.price < min) min = f.price;
        if (f.price > max) max = f.price;
      }
    }
    return { allAirlines: Array.from(airlines).sort(), priceRange: { min: min === Infinity ? 0 : min, max } };
  }, [legResults]);

  if (legResults.length === 0 || priceRange.max === 0) return null;

  const currentMax = filters.maxPrice ?? priceRange.max;

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
      <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">Filters</h3>

      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400">Max price: ${currentMax}</label>
        <input
          type="range"
          min={priceRange.min}
          max={priceRange.max}
          value={currentMax}
          onChange={(e) => {
            const val = Number(e.target.value);
            onChange({ ...filters, maxPrice: val >= priceRange.max ? null : val });
          }}
          className="w-full mt-1 accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>${priceRange.min}</span>
          <span>${priceRange.max}</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400">Max stops</label>
        <div className="flex gap-2 mt-1">
          {[
            { label: "Any", value: null },
            { label: "Non-stop", value: 0 },
            { label: "1 stop", value: 1 },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => onChange({ ...filters, maxStops: opt.value })}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                filters.maxStops === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {allAirlines.length > 1 && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Airlines</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {allAirlines.map((airline) => {
              const active = filters.airlines.size === 0 || filters.airlines.has(airline);
              return (
                <button
                  key={airline}
                  onClick={() => {
                    const next = new Set(filters.airlines);
                    if (filters.airlines.size === 0) {
                      allAirlines.forEach((a) => { if (a !== airline) next.add(a); });
                    } else if (next.has(airline)) {
                      next.delete(airline);
                      if (next.size === 0) { onChange({ ...filters, airlines: new Set() }); return; }
                    } else {
                      next.add(airline);
                      if (next.size === allAirlines.length) { onChange({ ...filters, airlines: new Set() }); return; }
                    }
                    onChange({ ...filters, airlines: next });
                  }}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 line-through"
                  }`}
                >
                  {airline}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function applyFilters(legResults: LegSearchResult[], filters: FilterState): LegSearchResult[] {
  return legResults.map((leg) => {
    const filtered = leg.flights.filter((f) => {
      if (filters.maxPrice !== null && f.price > filters.maxPrice) return false;
      if (filters.maxStops !== null && f.stops > filters.maxStops) return false;
      if (filters.airlines.size > 0 && !filters.airlines.has(f.airline)) return false;
      return true;
    });
    return {
      ...leg,
      flights: filtered,
      cheapest_price: (() => { const prices = filtered.map((f) => f.price).filter((p) => typeof p === "number" && !isNaN(p)); return prices.length > 0 ? Math.min(...prices) : null; })(),
    };
  });
}
