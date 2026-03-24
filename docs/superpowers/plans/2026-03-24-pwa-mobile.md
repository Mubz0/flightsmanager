# PWA Mobile Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert FlightsManager into a fully installable mobile PWA with offline read access, a service worker, and a native-feeling bottom tab bar (Chat | Pinned).

**Architecture:** Add `@ducanh2912/next-pwa` to auto-generate a Workbox service worker via `next.config.ts`. Move `PinProvider` up to a new `ClientProviders` wrapper in `layout.tsx` so both the Chat and Pinned routes share pin state. Add a bottom tab bar and offline banner as new client components. The Pinned drawer becomes a dedicated `/pinned` route.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, `@ducanh2912/next-pwa`, Vitest + Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `next.config.ts` | Modify | Wrap config with `withPWA` |
| `src/sw-entry.js` | Create | Custom service worker entry (if needed) |
| `src/components/client-providers.tsx` | Create | "use client" wrapper: `PinProvider` + layout chrome |
| `src/components/bottom-nav.tsx` | Create | Bottom tab bar: Chat / Pinned |
| `src/components/offline-banner.tsx` | Create | Online/offline listener + banner UI |
| `src/app/layout.tsx` | Modify | Import `ClientProviders`, add safe-area body padding |
| `src/app/page.tsx` | Modify | Remove `PinProvider` wrapper + `PinnedDrawerWrapper` |
| `src/app/pinned/page.tsx` | Create | `/pinned` route — full-screen pinned items view |
| `src/__tests__/components/offline-banner.test.tsx` | Create | Unit tests for OfflineBanner |
| `src/__tests__/components/bottom-nav.test.tsx` | Create | Unit tests for BottomNav |

---

## Chunk 1: Service Worker

### Task 1: Install PWA package

- [ ] **Step 1: Install `@ducanh2912/next-pwa`**

```bash
npm install @ducanh2912/next-pwa
```

Expected: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Update `next.config.ts`**

Replace the entire file with:

```ts
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withPWA(nextConfig);
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: build completes, `public/sw.js` and `public/workbox-*.js` are generated.

- [ ] **Step 4: Add generated PWA files to `.gitignore`**

Open `.gitignore` and add:

```
public/sw.js
public/workbox-*.js
public/worker-*.js
public/fallback-*.js
```

- [ ] **Step 5: Commit**

```bash
git add next.config.ts .gitignore package.json package-lock.json
git commit -m "feat: add next-pwa service worker"
```

---

## Chunk 2: Offline Banner + Bottom Nav Components

### Task 2: OfflineBanner component

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/offline-banner.test.tsx`:

```tsx
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OfflineBanner } from "@/components/offline-banner";

describe("OfflineBanner", () => {
  const fireOnline = () => window.dispatchEvent(new Event("online"));
  const fireOffline = () => window.dispatchEvent(new Event("offline"));

  beforeEach(() => {
    // Start as online
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
  });

  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows banner when offline event fires", () => {
    render(<OfflineBanner />);
    act(() => fireOffline());
    expect(screen.getByText(/you're offline/i)).toBeTruthy();
  });

  it("hides banner when back online", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true, writable: true });
    render(<OfflineBanner />);
    act(() => fireOffline());
    expect(screen.getByText(/you're offline/i)).toBeTruthy();
    act(() => fireOnline());
    expect(screen.queryByText(/you're offline/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose src/__tests__/components/offline-banner.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/offline-banner'`

- [ ] **Step 3: Create `src/components/offline-banner.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="w-full px-4 py-2 text-center text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
      You&apos;re offline. Past results are still available.
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose src/__tests__/components/offline-banner.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/offline-banner.tsx src/__tests__/components/offline-banner.test.tsx
git commit -m "feat: add OfflineBanner component"
```

---

### Task 3: BottomNav component

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/bottom-nav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomNav } from "@/components/bottom-nav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("BottomNav", () => {
  it("marks Chat tab active on /", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<BottomNav pinnedCount={0} />);
    const chatTab = screen.getByRole("link", { name: /chat/i });
    expect(chatTab.className).toMatch(/text-blue/);
  });

  it("marks Pinned tab active on /pinned", () => {
    vi.mocked(usePathname).mockReturnValue("/pinned");
    render(<BottomNav pinnedCount={3} />);
    const pinnedTab = screen.getByRole("link", { name: /pinned/i });
    expect(pinnedTab.className).toMatch(/text-blue/);
  });

  it("shows pinned count badge when > 0", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<BottomNav pinnedCount={5} />);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("hides badge when pinned count is 0", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<BottomNav pinnedCount={0} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose src/__tests__/components/bottom-nav.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/bottom-nav'`

- [ ] **Step 3: Create `src/components/bottom-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface BottomNavProps {
  pinnedCount: number;
}

export function BottomNav({ pinnedCount }: BottomNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Chat", icon: ChatIcon },
    { href: "/pinned", label: "Pinned", icon: PinIcon },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        const isPin = href === "/pinned";
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors relative min-h-[56px] ${
              active
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className="relative">
              <Icon className="w-6 h-6" />
              {isPin && pinnedCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {pinnedCount}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose src/__tests__/components/bottom-nav.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/bottom-nav.tsx src/__tests__/components/bottom-nav.test.tsx
git commit -m "feat: add BottomNav component"
```

---

## Chunk 3: Pinned Page + Providers + Wiring

### Task 4: Create `/pinned` page

- [ ] **Step 1: Create `src/app/pinned/page.tsx`**

This page renders the full pinned items view (same content as the former drawer, now full-screen). It reads from `usePins` which will be provided by `PinProvider` in the layout.

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pinned/page.tsx
git commit -m "feat: add /pinned tab page"
```

---

### Task 5: Create `ClientProviders` and wire layout

`PinProvider` currently lives inside `page.tsx`. It needs to move up to `layout.tsx` so both `page.tsx` (Chat) and `pinned/page.tsx` share the same pin state. Since `layout.tsx` is a Server Component, we use a thin `"use client"` wrapper.

- [ ] **Step 1: Create `src/components/client-providers.tsx`**

```tsx
"use client";

import { PinProvider, usePins } from "@/components/pin-context";
import { OfflineBanner } from "@/components/offline-banner";
import { BottomNav } from "@/components/bottom-nav";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PinProvider>
      <OfflineBanner />
      <div
        className="flex flex-col"
        style={{
          minHeight: "100dvh",
          paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <BottomNavWithPins />
    </PinProvider>
  );
}

function BottomNavWithPins() {
  const { totalPinned } = usePins();
  return <BottomNav pinnedCount={totalPinned} />;
}
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

Import and use `ClientProviders`:

```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/client-providers";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://app-flightsmanager.azurewebsites.net"),
  title: "FlightsManager — AI Travel Agent",
  description: "Find the cheapest flights with a conversational AI travel agent. Compare prices, explore destinations, and get personalized recommendations.",
  keywords: ["flights", "cheap flights", "AI travel agent", "flight search", "travel", "flight comparison"],
  authors: [{ name: "FlightsManager" }],
  openGraph: {
    title: "FlightsManager — AI Travel Agent",
    description: "Ask in plain English. Get the cheapest flights. Compare destinations. Your AI-powered travel agent.",
    type: "website",
    siteName: "FlightsManager",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlightsManager — AI Travel Agent",
    description: "Ask in plain English. Get the cheapest flights. Compare destinations.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlightsManager",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-[#0a0a0a]`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update `src/app/page.tsx` — remove `PinProvider` wrapper and `PinnedDrawerWrapper`**

The file currently wraps everything in `<PinProvider>` and renders `<PinnedDrawerWrapper />` at the bottom. Both must be removed since `PinProvider` is now in the layout.

Remove the `PinProvider` import, the `PinProvider` wrapper in the JSX, and the entire `PinnedDrawerWrapper` function and its render call. Also add bottom padding to the `<main>` so the chat input doesn't get covered by the tab bar.

The updated return value of `Home`:

```tsx
return (
  <main className="flex flex-col h-dvh">
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      {/* ... header content unchanged ... */}
    </div>

    {/* Messages */}
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* ... messages content unchanged ... */}
    </div>

    {/* Input */}
    <div className="border-t border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <ChatInput
          onSend={(text) => sendMessage({ text })}
          onStop={stop}
          isLoading={isLoading}
        />
      </div>
    </div>
  </main>
);
```

Key changes from original:
- Remove `<PinProvider>` wrapper (now in layout)
- Remove `<PinnedDrawerWrapper />` at bottom
- Change `h-screen` → `h-dvh` (better for mobile browsers with dynamic viewport)
- Remove `PinProvider` and `usePins` imports from page.tsx

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/client-providers.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "feat: wire ClientProviders, BottomNav, and OfflineBanner into layout"
```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open on mobile or use Chrome DevTools device emulation**

Open `http://localhost:3000` in Chrome. Toggle device emulation (iPhone 14 or similar).

Verify:
- Bottom tab bar appears with Chat and Pinned tabs
- Chat tab is active on `/`
- Typing and sending a message works, chat input stays above tab bar
- Pin a flight — badge appears on Pinned tab
- Tap Pinned tab — navigates to `/pinned` and shows the pinned item
- Unpinning works on `/pinned`
- Switching back to Chat tab — chat state is preserved (messages still visible)

- [ ] **Step 3: Test offline banner**

In Chrome DevTools > Network tab, set to "Offline".

Verify:
- Yellow banner appears at top: "You're offline. Past results are still available."
- Restore network — banner disappears automatically.

- [ ] **Step 4: Test PWA installability (production build only)**

```bash
npm run build && npm start
```

Open `http://localhost:3000` in Chrome. In the address bar you should see an install icon (or go to `⋮` menu > "Install FlightsManager").

- [ ] **Step 5: Commit if any fixes needed, otherwise done**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```
