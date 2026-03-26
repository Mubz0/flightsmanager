"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface PriceAlert {
  id: string;
  origin: string;
  destination: string;
  date: string;
  targetPrice: number;
  currency: string;
  createdAt: number;
  lastCheckedPrice?: number;
  triggered?: boolean;
}

const ALERTS_KEY = "flight-price-alerts";
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch { /* quota exceeded */ }
}

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${currency} ${price}`;
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollRef = useRef<number>(0);

  // Load alerts from localStorage on mount
  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  // Dismiss notification after 6 seconds
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(t);
  }, [notification]);

  const checkPrices = useCallback(async (currentAlerts: PriceAlert[]) => {
    if (currentAlerts.length === 0) return;
    if (Date.now() - lastPollRef.current < 60_000) return; // debounce
    lastPollRef.current = Date.now();
    setChecking(true);

    const updated = [...currentAlerts];
    let anyTriggered = false;

    await Promise.allSettled(
      updated.map(async (alert, idx) => {
        try {
          const res = await fetch("/api/price-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: alert.origin,
              destination: alert.destination,
              date: alert.date,
              currency: alert.currency,
            }),
          });
          const { price } = await res.json();
          if (typeof price === "number") {
            updated[idx] = { ...updated[idx], lastCheckedPrice: price };
            if (price <= alert.targetPrice && !updated[idx].triggered) {
              updated[idx] = { ...updated[idx], triggered: true };
              anyTriggered = true;
            } else if (price > alert.targetPrice) {
              // Reset triggered if price goes back up
              updated[idx] = { ...updated[idx], triggered: false };
            }
          }
        } catch { /* network error — skip */ }
      })
    );

    setAlerts(updated);
    saveAlerts(updated);

    if (anyTriggered) {
      const newlyTriggered = updated.filter((a) => a.triggered);
      const first = newlyTriggered[0];
      setNotification(
        `Price alert: ${first.origin} → ${first.destination} is now ${formatPrice(first.lastCheckedPrice ?? first.targetPrice, first.currency)} — at or below your target!`
      );
    }

    setChecking(false);
  }, []);

  // Poll when page is visible
  useEffect(() => {
    const startPolling = () => {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          setAlerts((prev) => {
            checkPrices(prev);
            return prev;
          });
        }
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    startPolling();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopPolling();
    };
  }, [checkPrices]);

  // Check prices when panel opens
  useEffect(() => {
    if (open) {
      setAlerts((prev) => {
        checkPrices(prev);
        return prev;
      });
    }
  }, [open, checkPrices]);

  const deleteAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      saveAlerts(updated);
      return updated;
    });
  }, []);

  const triggeredCount = alerts.filter((a) => a.triggered).length;

  return (
    <>
      {/* Triggered notification banner */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-2 px-4 py-3 rounded-xl bg-green-600 text-white text-sm shadow-lg flex items-start gap-3 animate-in slide-in-from-top-2">
          <span className="text-base leading-none mt-0.5">&#x1F514;</span>
          <p className="flex-1 leading-snug">{notification}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-white/70 hover:text-white ml-1 text-lg leading-none"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* Alerts button — fixed bottom-right */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Price Alerts"
      >
        <span>Alerts</span>
        {triggeredCount > 0 ? (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[10px] font-bold">
            {triggeredCount}
          </span>
        ) : alerts.length > 0 ? (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold">
            {alerts.length}
          </span>
        ) : null}
      </button>

      {/* Slide-up panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-700">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Price Alerts</h2>
                {checking && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    Checking...
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Alert list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {alerts.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">No price alerts set.</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
                    Tap &ldquo;Set alert&rdquo; on any flight card to track its price.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function AlertRow({ alert, onDelete }: { alert: PriceAlert; onDelete: (id: string) => void }) {
  const isTriggered = alert.triggered;
  const currentPrice = alert.lastCheckedPrice;
  const priceDiff = currentPrice != null ? currentPrice - alert.targetPrice : null;

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${isTriggered ? "bg-green-50 dark:bg-green-950/40" : ""}`}>
      {/* Status dot */}
      <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${isTriggered ? "bg-green-500" : "bg-blue-400"}`} />

      <div className="flex-1 min-w-0">
        {/* Route */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {alert.origin} &rarr; {alert.destination}
          </span>
          <span className="text-xs text-gray-400">{formatDate(alert.date)}</span>
        </div>

        {/* Prices */}
        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            Target: <span className="font-medium text-gray-700 dark:text-gray-200">{formatPrice(alert.targetPrice, alert.currency)}</span>
          </span>
          {currentPrice != null && (
            <span className={`font-medium ${isTriggered ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-300"}`}>
              Current: {formatPrice(currentPrice, alert.currency)}
              {priceDiff != null && priceDiff !== 0 && (
                <span className={`ml-1 ${priceDiff < 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  ({priceDiff > 0 ? "+" : ""}{formatPrice(priceDiff, alert.currency)})
                </span>
              )}
            </span>
          )}
        </div>

        {isTriggered && (
          <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">
            Price is at or below your target!
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(alert.id)}
        className="flex-shrink-0 text-xs text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors mt-0.5"
        aria-label="Delete alert"
      >
        &times;
      </button>
    </div>
  );
}
