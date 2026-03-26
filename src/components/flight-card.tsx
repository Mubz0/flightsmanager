"use client";

import { useState } from "react";
import type { FlightResult } from "@/lib/types";
import type { PriceAlert } from "@/components/price-alerts";

const ALERTS_KEY = "flight-price-alerts";

function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch { /* quota exceeded */ }
}

interface FlightCardProps {
  flight: FlightResult;
  isCheapest?: boolean;
  onPin?: (flight: FlightResult) => void;
  isPinned?: boolean;
  co2Context?: { min: number; max: number };
}

export function FlightCard({ flight, isCheapest, onPin, isPinned, co2Context }: FlightCardProps) {
  const hours = Math.floor(flight.duration_minutes / 60);
  const mins = flight.duration_minutes % 60;

  // Price alert state
  const defaultTarget = Math.floor(flight.price * 0.9);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [targetPrice, setTargetPrice] = useState(String(defaultTarget));
  const [alertSaved, setAlertSaved] = useState(false);

  function handleSaveAlert() {
    const price = Number(targetPrice);
    if (isNaN(price) || price <= 0) return;
    const alert: PriceAlert = {
      id: `${flight.origin}-${flight.destination}-${flight.departure_date ?? ""}-${Date.now()}`,
      origin: flight.origin,
      destination: flight.destination,
      date: flight.departure_date ?? flight.departure_time.split(" ")[0],
      targetPrice: price,
      currency: flight.currency,
      createdAt: Date.now(),
    };
    const existing = loadAlerts().filter(
      (a) => !(a.origin === alert.origin && a.destination === alert.destination && a.date === alert.date)
    );
    saveAlerts([alert, ...existing]);
    setShowAlertForm(false);
    setAlertSaved(true);
    setTimeout(() => setAlertSaved(false), 3000);
  }

  return (
    <div className={`relative p-4 rounded-lg border ${isCheapest ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"} hover:shadow-md transition-shadow`}>
      {isCheapest && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">CHEAPEST</span>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center justify-between sm:block sm:flex-1">
          <div className="flex items-center gap-2 text-base sm:text-lg font-semibold dark:text-gray-100">
            <span>{formatTime(flight.departure_time)}</span>
            <span className="text-gray-400">—</span>
            <span>{formatTime(flight.arrival_time)}</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 sm:hidden">
            {formatPrice(flight.price, flight.currency)}
            {flight.trip_type === "round_trip" && <span className="text-xs font-normal text-gray-500 ml-1">RT</span>}
          </div>
        </div>
        <div className="flex items-center sm:block sm:flex-1 sm:text-center gap-3">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {flight.airline} &middot; {flight.flight_number}
            {flight.departure_date && <span className="ml-1 text-gray-400">{formatDate(flight.departure_date)}</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {hours}h{mins > 0 ? ` ${mins}m` : ""} &middot; {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            {flight.layovers.length > 0 && ` (${flight.layovers.map((l) => l.airport).join(", ")})`}
          </div>
        </div>
        <div className="flex items-center justify-between sm:block sm:text-right">
          <div className="hidden sm:block">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPrice(flight.price, flight.currency)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{flight.currency}{flight.trip_type === "round_trip" && " round-trip"}</div>
          </div>
          <div className="flex items-center gap-2">
            {onPin && (
              <button
                onClick={() => onPin(flight)}
                className={`px-2 py-1.5 text-xs rounded-lg transition-colors ${isPinned ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" : "bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-800 dark:text-gray-400"}`}
                title={isPinned ? "Pinned" : "Pin to compare"}
              >
                {isPinned ? "Pinned" : "Pin"}
              </button>
            )}
            <button
              onClick={() => { setShowAlertForm((v) => !v); setTargetPrice(String(defaultTarget)); }}
              className={`px-2 py-1.5 text-xs rounded-lg transition-colors ${alertSaved ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-800 dark:text-gray-400"}`}
              title="Set a price alert"
            >
              {alertSaved ? "Alert set!" : "Alert"}
            </button>
            <a
              href={buildBookingUrl(flight)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Book
            </a>
          </div>
        </div>
      </div>
      {flight.layovers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            {flight.layovers.map((l, i) => (
              <span key={i}>{l.airport}{l.duration_minutes > 0 ? `: ${Math.floor(l.duration_minutes / 60)}h ${l.duration_minutes % 60}m layover` : " layover"}</span>
            ))}
          </div>
        </div>
      )}

      {flight.co2_emissions_kg != null && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          {(() => {
            const kg = Math.round(flight.co2_emissions_kg!);
            const base = `~${kg} kg CO₂`;
            if (!co2Context || co2Context.min === co2Context.max) {
              return <span className="text-gray-400 dark:text-gray-500">{base}</span>;
            }
            if (flight.co2_emissions_kg === co2Context.min) {
              return (
                <>
                  <span className="text-gray-400 dark:text-gray-500">{base}</span>
                  <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-medium">Lowest CO₂</span>
                </>
              );
            }
            if (flight.co2_emissions_kg === co2Context.max) {
              return (
                <>
                  <span className="text-gray-400 dark:text-gray-500">{base}</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">Highest CO₂</span>
                </>
              );
            }
            const pct = Math.round(((flight.co2_emissions_kg! - co2Context.min) / co2Context.min) * 100);
            return (
              <>
                <span className="text-gray-400 dark:text-gray-500">{base}</span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">+{pct}%</span>
              </>
            );
          })()}
        </div>
      )}

      {showAlertForm && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Notify me when {flight.origin} &rarr; {flight.destination} drops to or below:
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{flight.currency}</span>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              min={1}
              className="w-28 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Target price"
            />
            <button
              onClick={handleSaveAlert}
              className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Save alert
            </button>
            <button
              onClick={() => setShowAlertForm(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">Pre-filled at 10% below current price. We&rsquo;ll check every 10 min while the app is open.</p>
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

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch { return `${currency} ${price}`; }
}

function buildBookingUrl(flight: FlightResult): string {
  if (flight.google_flights_url) return flight.google_flights_url;
  const date = flight.departure_date || flight.departure_time.split(" ")[0];
  return `https://www.google.com/travel/flights?q=Flights+from+${flight.origin}+to+${flight.destination}+on+${date}+one+way`;
}
