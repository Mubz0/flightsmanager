# FlightsManager POC Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered flight search POC that parses natural language queries into multi-leg Google Flights searches with real-time streaming results.

**Architecture:** Single Next.js codebase (App Router) on Azure Static Web Apps. API routes handle Azure OpenAI intent parsing (Function Calling) and concurrent SerpApi flight searches. SSE streams progress and results to the frontend.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vercel AI SDK, Azure OpenAI (gpt-4o-mini), SerpApi

---

## File Structure

```
flightsmanager/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with fonts/metadata
│   │   ├── page.tsx                    # Home page with search UI
│   │   └── api/
│   │       └── search/
│   │           └── route.ts            # SSE streaming API route
│   ├── lib/
│   │   ├── openai.ts                   # Azure OpenAI client config
│   │   ├── serpapi.ts                   # SerpApi client + flight search
│   │   ├── flight-filter.ts            # Stopover filtering logic
│   │   ├── intent-parser.ts            # Function Calling schema + parsing
│   │   └── types.ts                    # Shared TypeScript types
│   └── components/
│       ├── search-bar.tsx              # Magic Search input
│       ├── flight-card.tsx             # Single flight result card
│       ├── flight-results.tsx          # Results list + summary
│       └── stream-status.tsx           # Streaming progress indicator
├── __tests__/
│   ├── lib/
│   │   ├── flight-filter.test.ts       # Stopover filtering tests
│   │   ├── intent-parser.test.ts       # Intent parsing tests
│   │   └── serpapi.test.ts             # SerpApi response parsing tests
│   └── components/
│       └── flight-card.test.tsx        # Flight card rendering tests
├── .env.local.example                  # Environment variable template
├── next.config.ts                      # Next.js config
├── tailwind.config.ts                  # Tailwind config
├── tsconfig.json                       # TypeScript config
├── package.json                        # Dependencies
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-03-16-flightsmanager-design.md
        └── plans/
            └── 2026-03-16-flightsmanager-poc.md
```

---

## Chunk 1: Project Setup & Types

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env.local.example`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/developer/flightsmanager
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --yes
```

Expected: Next.js project scaffolded with App Router, TypeScript, Tailwind

- [ ] **Step 2: Install dependencies**

```bash
npm install ai @ai-sdk/azure openai serpapi
npm install -D @types/node vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create .env.local.example**

Create file `.env.local.example`:
```
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
SERPAPI_API_KEY=your-serpapi-key-here
```

- [ ] **Step 4: Create vitest config**

Create file `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: Add test script to package.json**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify setup**

```bash
npm run build
npm run test
```

Expected: Build succeeds, test runner initializes (0 tests)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with TypeScript, Tailwind, Vitest"
```

---

### Task 2: Define Shared Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Write types file**

Create file `src/lib/types.ts`:
```typescript
// Parsed intent from Azure OpenAI Function Calling
export interface FlightSearchIntent {
  legs: FlightLeg[];
  excluded_stopover_airports?: string[];
  excluded_stopover_countries?: string[];
  cabin_class?: "economy" | "premium_economy" | "business" | "first";
  max_stops?: number;
  preferred_airlines?: string[];
}

export interface FlightLeg {
  origin: string; // IATA code
  destination: string; // IATA code
  date: string; // YYYY-MM-DD
  date_flexibility?: number; // days ± to search
}

// Normalized flight result from SerpApi
export interface FlightResult {
  airline: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  origin: string; // IATA code
  destination: string; // IATA code
  stops: number;
  layovers: Layover[];
  price: number;
  currency: string;
  cabin_class: string;
  co2_emissions_kg?: number;
}

export interface Layover {
  airport: string; // IATA code
  city: string;
  country: string;
  duration_minutes: number;
}

// Leg search result (groups flights for one leg)
export interface LegSearchResult {
  leg: FlightLeg;
  flights: FlightResult[];
  cheapest_price: number | null;
  error?: string;
}

// SSE stream event types
export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "leg_result"; data: LegSearchResult }
  | { type: "summary"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit src/lib/types.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types for flight search"
```

---

## Chunk 2: Backend Core — Intent Parsing & Flight Search

### Task 3: Intent Parser (Azure OpenAI Function Calling)

**Files:**
- Create: `src/lib/intent-parser.ts`
- Test: `__tests__/lib/intent-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create file `__tests__/lib/intent-parser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  FLIGHT_SEARCH_TOOL,
  parseIntentFromToolCall,
} from "@/lib/intent-parser";
import type { FlightSearchIntent } from "@/lib/types";

describe("intent-parser", () => {
  describe("FLIGHT_SEARCH_TOOL", () => {
    it("has the correct function name", () => {
      expect(FLIGHT_SEARCH_TOOL.type).toBe("function");
      expect(FLIGHT_SEARCH_TOOL.function.name).toBe("search_flights");
    });

    it("requires legs parameter", () => {
      const required =
        FLIGHT_SEARCH_TOOL.function.parameters.required;
      expect(required).toContain("legs");
    });
  });

  describe("parseIntentFromToolCall", () => {
    it("parses a simple one-way search", () => {
      const toolCallArgs = JSON.stringify({
        legs: [
          { origin: "SZX", destination: "LHR", date: "2026-03-25" },
        ],
      });

      const result = parseIntentFromToolCall(toolCallArgs);

      expect(result.legs).toHaveLength(1);
      expect(result.legs[0].origin).toBe("SZX");
      expect(result.legs[0].destination).toBe("LHR");
      expect(result.legs[0].date).toBe("2026-03-25");
    });

    it("parses multi-leg with exclusions", () => {
      const toolCallArgs = JSON.stringify({
        legs: [
          { origin: "BKK", destination: "CNX", date: "2026-03-20" },
          { origin: "CNX", destination: "HKG", date: "2026-03-22" },
          {
            origin: "SZX",
            destination: "LHR",
            date: "2026-03-25",
            date_flexibility: 2,
          },
        ],
        excluded_stopover_airports: ["DXB", "AUH", "DOH"],
        preferred_airlines: ["MU", "CZ", "CA"],
      });

      const result = parseIntentFromToolCall(toolCallArgs);

      expect(result.legs).toHaveLength(3);
      expect(result.excluded_stopover_airports).toEqual([
        "DXB",
        "AUH",
        "DOH",
      ]);
      expect(result.preferred_airlines).toEqual(["MU", "CZ", "CA"]);
    });

    it("throws on invalid JSON", () => {
      expect(() => parseIntentFromToolCall("not json")).toThrow();
    });

    it("throws when legs is missing", () => {
      expect(() =>
        parseIntentFromToolCall(JSON.stringify({}))
      ).toThrow("legs");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- __tests__/lib/intent-parser.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create file `src/lib/intent-parser.ts`:
```typescript
import type { FlightSearchIntent } from "./types";

export const FLIGHT_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "search_flights",
    description:
      "Search for flights based on the user's travel request. Convert all city names to IATA airport codes. Convert vague dates like 'late March' to a specific date with date_flexibility.",
    parameters: {
      type: "object",
      properties: {
        legs: {
          type: "array",
          description: "Individual flight legs to search",
          items: {
            type: "object",
            properties: {
              origin: {
                type: "string",
                description: "Origin IATA airport code (e.g. BKK, SZX, LHR)",
              },
              destination: {
                type: "string",
                description:
                  "Destination IATA airport code (e.g. LHR, CNX, HKG)",
              },
              date: {
                type: "string",
                description: "Departure date in YYYY-MM-DD format",
              },
              date_flexibility: {
                type: "number",
                description:
                  "Number of days +/- to search around the date. Use 2-3 for flexible dates.",
              },
            },
            required: ["origin", "destination", "date"],
          },
        },
        excluded_stopover_airports: {
          type: "array",
          items: { type: "string" },
          description:
            "IATA codes of airports to exclude as stopovers (e.g. DXB, AUH for avoiding UAE)",
        },
        excluded_stopover_countries: {
          type: "array",
          items: { type: "string" },
          description: "Country names to exclude as stopover locations",
        },
        cabin_class: {
          type: "string",
          enum: ["economy", "premium_economy", "business", "first"],
          description: "Cabin class, defaults to economy",
        },
        max_stops: {
          type: "number",
          description: "Maximum number of stops per leg",
        },
        preferred_airlines: {
          type: "array",
          items: { type: "string" },
          description: "Preferred airline IATA codes (e.g. MU, CZ, CA)",
        },
      },
      required: ["legs"],
    },
  },
} as const;

export function parseIntentFromToolCall(
  argsJson: string
): FlightSearchIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argsJson);
  } catch {
    throw new Error(`Invalid JSON in tool call arguments: ${argsJson}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.legs || !Array.isArray(obj.legs) || obj.legs.length === 0) {
    throw new Error("Tool call must include at least one flight leg in 'legs'");
  }

  return obj as unknown as FlightSearchIntent;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- __tests__/lib/intent-parser.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/intent-parser.ts __tests__/lib/intent-parser.test.ts
git commit -m "feat: add intent parser with Function Calling schema"
```

---

### Task 4: SerpApi Client

**Files:**
- Create: `src/lib/serpapi.ts`
- Test: `__tests__/lib/serpapi.test.ts`

- [ ] **Step 1: Write the failing test**

Create file `__tests__/lib/serpapi.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeSerpApiResponse,
  buildSerpApiUrl,
} from "@/lib/serpapi";

describe("serpapi", () => {
  describe("buildSerpApiUrl", () => {
    it("builds correct URL for one-way flight", () => {
      const url = buildSerpApiUrl({
        origin: "SZX",
        destination: "LHR",
        date: "2026-03-25",
        apiKey: "test-key",
      });

      expect(url).toContain("engine=google_flights");
      expect(url).toContain("departure_id=SZX");
      expect(url).toContain("arrival_id=LHR");
      expect(url).toContain("outbound_date=2026-03-25");
      expect(url).toContain("type=2"); // one-way
      expect(url).toContain("api_key=test-key");
    });
  });

  describe("normalizeSerpApiResponse", () => {
    it("normalizes a flight from SerpApi response", () => {
      const serpApiData = {
        best_flights: [
          {
            flights: [
              {
                airline: "China Eastern",
                flight_number: "MU 504",
                departure_airport: { id: "SZX", time: "2026-03-25 07:15" },
                arrival_airport: { id: "PVG", time: "2026-03-25 09:45" },
                duration: 150,
              },
              {
                airline: "China Eastern",
                flight_number: "MU 551",
                departure_airport: { id: "PVG", time: "2026-03-25 13:15" },
                arrival_airport: { id: "LHR", time: "2026-03-25 18:40" },
                duration: 745,
              },
            ],
            layovers: [
              {
                name: "Shanghai Pudong",
                id: "PVG",
                duration: 210,
              },
            ],
            total_duration: 1105,
            price: 330,
            carbon_emissions: { this_flight: 813000 },
          },
        ],
        other_flights: [],
      };

      const results = normalizeSerpApiResponse(serpApiData, "USD");

      expect(results).toHaveLength(1);
      expect(results[0].airline).toBe("China Eastern");
      expect(results[0].price).toBe(330);
      expect(results[0].origin).toBe("SZX");
      expect(results[0].destination).toBe("LHR");
      expect(results[0].stops).toBe(1);
      expect(results[0].layovers[0].airport).toBe("PVG");
      expect(results[0].layovers[0].duration_minutes).toBe(210);
      expect(results[0].duration_minutes).toBe(1105);
    });

    it("returns empty array for no flights", () => {
      const results = normalizeSerpApiResponse(
        { best_flights: [], other_flights: [] },
        "USD"
      );
      expect(results).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- __tests__/lib/serpapi.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create file `src/lib/serpapi.ts`:
```typescript
import type { FlightResult, Layover } from "./types";

interface BuildUrlParams {
  origin: string;
  destination: string;
  date: string;
  apiKey: string;
  cabinClass?: string;
}

export function buildSerpApiUrl(params: BuildUrlParams): string {
  const { origin, destination, date, apiKey, cabinClass } = params;
  const searchParams = new URLSearchParams({
    engine: "google_flights",
    departure_id: origin,
    arrival_id: destination,
    outbound_date: date,
    type: "2", // one-way
    currency: "USD",
    hl: "en",
    api_key: apiKey,
  });

  if (cabinClass) {
    const classMap: Record<string, string> = {
      economy: "1",
      premium_economy: "2",
      business: "3",
      first: "4",
    };
    searchParams.set("travel_class", classMap[cabinClass] || "1");
  }

  return `https://serpapi.com/search?${searchParams.toString()}`;
}

interface SerpApiFlight {
  flights: Array<{
    airline: string;
    flight_number: string;
    departure_airport: { id: string; time: string };
    arrival_airport: { id: string; time: string };
    duration: number;
  }>;
  layovers?: Array<{
    name: string;
    id: string;
    duration: number;
  }>;
  total_duration: number;
  price: number;
  carbon_emissions?: { this_flight: number };
}

interface SerpApiResponse {
  best_flights: SerpApiFlight[];
  other_flights: SerpApiFlight[];
}

export function normalizeSerpApiResponse(
  data: SerpApiResponse,
  currency: string
): FlightResult[] {
  const allFlights = [
    ...(data.best_flights || []),
    ...(data.other_flights || []),
  ];

  return allFlights.map((flight) => {
    const firstSegment = flight.flights[0];
    const lastSegment = flight.flights[flight.flights.length - 1];

    const layovers: Layover[] = (flight.layovers || []).map((l) => ({
      airport: l.id,
      city: l.name,
      country: "", // SerpApi doesn't always provide country
      duration_minutes: l.duration,
    }));

    return {
      airline: firstSegment.airline,
      flight_number: firstSegment.flight_number,
      departure_time: firstSegment.departure_airport.time,
      arrival_time: lastSegment.arrival_airport.time,
      duration_minutes: flight.total_duration,
      origin: firstSegment.departure_airport.id,
      destination: lastSegment.arrival_airport.id,
      stops: flight.flights.length - 1,
      layovers,
      price: flight.price,
      currency,
      cabin_class: "economy",
      co2_emissions_kg: flight.carbon_emissions
        ? Math.round(flight.carbon_emissions.this_flight / 1000)
        : undefined,
    };
  });
}

export async function searchFlights(
  origin: string,
  destination: string,
  date: string,
  apiKey: string,
  cabinClass?: string
): Promise<FlightResult[]> {
  const url = buildSerpApiUrl({
    origin,
    destination,
    date,
    apiKey,
    cabinClass,
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `SerpApi request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return normalizeSerpApiResponse(data, "USD");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- __tests__/lib/serpapi.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/serpapi.ts __tests__/lib/serpapi.test.ts
git commit -m "feat: add SerpApi client with response normalization"
```

---

### Task 5: Stopover Filter

**Files:**
- Create: `src/lib/flight-filter.ts`
- Test: `__tests__/lib/flight-filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create file `__tests__/lib/flight-filter.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { filterFlights } from "@/lib/flight-filter";
import type { FlightResult } from "@/lib/types";

const makeFlightWithLayover = (
  airport: string,
  price: number
): FlightResult => ({
  airline: "Test Air",
  flight_number: "TA 123",
  departure_time: "2026-03-25 07:00",
  arrival_time: "2026-03-25 18:00",
  duration_minutes: 660,
  origin: "SZX",
  destination: "LHR",
  stops: 1,
  layovers: [
    { airport, city: "Test City", country: "", duration_minutes: 120 },
  ],
  price,
  currency: "USD",
  cabin_class: "economy",
});

const directFlight: FlightResult = {
  airline: "Direct Air",
  flight_number: "DA 1",
  departure_time: "2026-03-25 13:00",
  arrival_time: "2026-03-25 20:00",
  duration_minutes: 780,
  origin: "SZX",
  destination: "LHR",
  stops: 0,
  layovers: [],
  price: 500,
  currency: "USD",
  cabin_class: "economy",
};

describe("filterFlights", () => {
  it("excludes flights with stopovers at excluded airports", () => {
    const flights = [
      makeFlightWithLayover("DXB", 300),
      makeFlightWithLayover("PVG", 330),
      directFlight,
    ];

    const result = filterFlights(flights, {
      excludedAirports: ["DXB", "AUH"],
    });

    expect(result).toHaveLength(2);
    expect(result[0].layovers[0]?.airport).toBe("PVG");
    expect(result[1].stops).toBe(0);
  });

  it("returns all flights when no exclusions", () => {
    const flights = [
      makeFlightWithLayover("DXB", 300),
      makeFlightWithLayover("PVG", 330),
    ];

    const result = filterFlights(flights, {});

    expect(result).toHaveLength(2);
  });

  it("sorts by price ascending", () => {
    const flights = [
      makeFlightWithLayover("PVG", 500),
      makeFlightWithLayover("PEK", 200),
      makeFlightWithLayover("CAN", 350),
    ];

    const result = filterFlights(flights, {});

    expect(result[0].price).toBe(200);
    expect(result[1].price).toBe(350);
    expect(result[2].price).toBe(500);
  });

  it("respects max stops filter", () => {
    const flights = [makeFlightWithLayover("PVG", 300), directFlight];

    const result = filterFlights(flights, { maxStops: 0 });

    expect(result).toHaveLength(1);
    expect(result[0].stops).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- __tests__/lib/flight-filter.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create file `src/lib/flight-filter.ts`:
```typescript
import type { FlightResult } from "./types";

interface FilterOptions {
  excludedAirports?: string[];
  maxStops?: number;
}

export function filterFlights(
  flights: FlightResult[],
  options: FilterOptions
): FlightResult[] {
  const { excludedAirports = [], maxStops } = options;

  const excludedSet = new Set(
    excludedAirports.map((a) => a.toUpperCase())
  );

  return flights
    .filter((flight) => {
      // Exclude flights with banned stopover airports
      if (excludedSet.size > 0) {
        const hasBannedStop = flight.layovers.some((l) =>
          excludedSet.has(l.airport.toUpperCase())
        );
        if (hasBannedStop) return false;
      }

      // Exclude flights exceeding max stops
      if (maxStops !== undefined && flight.stops > maxStops) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.price - b.price);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- __tests__/lib/flight-filter.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/flight-filter.ts __tests__/lib/flight-filter.test.ts
git commit -m "feat: add stopover filtering with price sorting"
```

---

## Chunk 3: Backend — Azure OpenAI Client & Streaming API Route

### Task 6: Azure OpenAI Client

**Files:**
- Create: `src/lib/openai.ts`

- [ ] **Step 1: Write the Azure OpenAI client**

Create file `src/lib/openai.ts`:
```typescript
import { createAzure } from "@ai-sdk/azure";

export function getAzureOpenAI() {
  return createAzure({
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    resourceName: extractResourceName(process.env.AZURE_OPENAI_ENDPOINT!),
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
  });
}

function extractResourceName(endpoint: string): string {
  // Extract resource name from https://your-resource.openai.azure.com
  const match = endpoint.match(/https:\/\/(.+?)\.openai\.azure\.com/);
  if (!match) {
    throw new Error(
      `Invalid Azure OpenAI endpoint: ${endpoint}. Expected format: https://<resource>.openai.azure.com`
    );
  }
  return match[1];
}

export function getDeploymentName(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/lib/openai.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: add Azure OpenAI client configuration"
```

---

### Task 7: Streaming API Route

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Write the SSE streaming API route**

Create file `src/app/api/search/route.ts`:
```typescript
import { generateText } from "ai";
import { getAzureOpenAI, getDeploymentName } from "@/lib/openai";
import {
  FLIGHT_SEARCH_TOOL,
  parseIntentFromToolCall,
} from "@/lib/intent-parser";
import { searchFlights } from "@/lib/serpapi";
import { filterFlights } from "@/lib/flight-filter";
import type {
  FlightSearchIntent,
  LegSearchResult,
  StreamEvent,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function sendEvent(
  controller: ReadableStreamDefaultController,
  event: StreamEvent
) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}

export async function POST(request: Request) {
  const { query } = await request.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const serpApiKey = process.env.SERPAPI_API_KEY;
  if (!serpApiKey) {
    return Response.json(
      { error: "SERPAPI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Parse intent
        sendEvent(controller, {
          type: "status",
          message: "Parsing your trip...",
        });

        const azure = getAzureOpenAI();
        const model = azure(getDeploymentName());

        const { toolCalls } = await generateText({
          model,
          tools: {
            search_flights: {
              description: FLIGHT_SEARCH_TOOL.function.description,
              parameters: FLIGHT_SEARCH_TOOL.function.parameters as never,
            },
          },
          toolChoice: { type: "tool", toolName: "search_flights" },
          prompt: query,
          system: `You are a flight search assistant. Parse the user's travel request into a structured search.
Always convert city names to IATA airport codes.
For vague dates like "late March", pick a specific date and set date_flexibility to 2-3.
For "no UAE", set excluded_stopover_airports to ["DXB", "AUH", "SHJ"].
For "no Qatar", add "DOH" to excluded_stopover_airports.
For "via China", set preferred_airlines to Chinese carriers like ["MU", "CZ", "CA", "ZH"].
Today's date is ${new Date().toISOString().split("T")[0]}.`,
        });

        if (!toolCalls || toolCalls.length === 0) {
          sendEvent(controller, {
            type: "error",
            message: "Could not understand the search query. Please try again.",
          });
          sendEvent(controller, { type: "done" });
          controller.close();
          return;
        }

        const intent = parseIntentFromToolCall(
          JSON.stringify(toolCalls[0].args)
        );

        // Step 2: Search each leg concurrently
        const legResults: LegSearchResult[] = [];

        const legPromises = intent.legs.map(async (leg) => {
          sendEvent(controller, {
            type: "status",
            message: `Searching ${leg.origin} → ${leg.destination} (${leg.date})...`,
          });

          const dates = generateDateRange(
            leg.date,
            leg.date_flexibility || 0
          );

          try {
            // Search all dates concurrently for this leg
            const allFlights = await Promise.all(
              dates.map((d) =>
                searchFlights(
                  leg.origin,
                  leg.destination,
                  d,
                  serpApiKey,
                  intent.cabin_class
                )
              )
            );

            let flights = allFlights.flat();

            // Apply filters
            flights = filterFlights(flights, {
              excludedAirports: intent.excluded_stopover_airports,
              maxStops: intent.max_stops,
            });

            const result: LegSearchResult = {
              leg,
              flights,
              cheapest_price:
                flights.length > 0
                  ? Math.min(...flights.map((f) => f.price))
                  : null,
            };

            sendEvent(controller, { type: "leg_result", data: result });
            return result;
          } catch (error) {
            const result: LegSearchResult = {
              leg,
              flights: [],
              cheapest_price: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Search failed",
            };
            sendEvent(controller, { type: "leg_result", data: result });
            return result;
          }
        });

        const results = await Promise.all(legPromises);

        // Step 3: Summarize with AI
        sendEvent(controller, {
          type: "status",
          message: "Summarizing best options...",
        });

        const summaryData = results.map((r) => ({
          route: `${r.leg.origin} → ${r.leg.destination}`,
          date: r.leg.date,
          cheapest: r.cheapest_price
            ? `$${r.cheapest_price}`
            : "No flights found",
          options: r.flights.slice(0, 3).map((f) => ({
            airline: f.airline,
            price: `$${f.price}`,
            duration: `${Math.floor(f.duration_minutes / 60)}h ${f.duration_minutes % 60}m`,
            stops: f.stops,
            layovers: f.layovers.map((l) => l.airport).join(", "),
          })),
        }));

        const { text: summary } = await generateText({
          model,
          prompt: `Summarize these flight search results concisely. Highlight the best value options and any notable trade-offs (price vs duration vs stops). Keep it brief — 3-4 sentences max.\n\n${JSON.stringify(summaryData, null, 2)}`,
        });

        sendEvent(controller, { type: "summary", text: summary });
        sendEvent(controller, { type: "done" });
      } catch (error) {
        sendEvent(controller, {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        });
        sendEvent(controller, { type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function generateDateRange(
  centerDate: string,
  flexibility: number
): string[] {
  if (flexibility === 0) return [centerDate];

  const dates: string[] = [];
  const center = new Date(centerDate);

  for (let i = -flexibility; i <= flexibility; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: add SSE streaming API route for flight search"
```

---

## Chunk 4: Frontend Components

### Task 8: Stream Status Component

**Files:**
- Create: `src/components/stream-status.tsx`

- [ ] **Step 1: Write the component**

Create file `src/components/stream-status.tsx`:
```tsx
interface StreamStatusProps {
  message: string;
  isActive: boolean;
}

export function StreamStatus({ message, isActive }: StreamStatusProps) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 text-blue-800">
      {isActive && (
        <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      )}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stream-status.tsx
git commit -m "feat: add streaming status indicator component"
```

---

### Task 9: Flight Card Component

**Files:**
- Create: `src/components/flight-card.tsx`

- [ ] **Step 1: Write the component**

Create file `src/components/flight-card.tsx`:
```tsx
import type { FlightResult } from "@/lib/types";

interface FlightCardProps {
  flight: FlightResult;
  isCheapest?: boolean;
}

export function FlightCard({ flight, isCheapest }: FlightCardProps) {
  const hours = Math.floor(flight.duration_minutes / 60);
  const mins = flight.duration_minutes % 60;

  return (
    <div
      className={`relative p-4 rounded-lg border ${
        isCheapest
          ? "border-green-500 bg-green-50"
          : "border-gray-200 bg-white"
      } hover:shadow-md transition-shadow`}
    >
      {isCheapest && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
          CHEAPEST
        </span>
      )}

      <div className="flex items-center justify-between">
        {/* Left: Times & Route */}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>{formatTime(flight.departure_time)}</span>
            <span className="text-gray-400">—</span>
            <span>{formatTime(flight.arrival_time)}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {flight.airline} &middot; {flight.flight_number}
          </div>
        </div>

        {/* Middle: Duration & Stops */}
        <div className="flex-1 text-center">
          <div className="text-sm font-medium">
            {hours}h {mins > 0 ? `${mins}m` : ""}
          </div>
          <div className="flex items-center justify-center gap-1 my-1">
            <div className="h-px w-16 bg-gray-300" />
            {flight.stops > 0 && (
              <div className="h-2 w-2 rounded-full bg-gray-400" />
            )}
            <div className="h-px w-16 bg-gray-300" />
          </div>
          <div className="text-xs text-gray-500">
            {flight.stops === 0
              ? "Non-stop"
              : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            {flight.layovers.length > 0 &&
              ` (${flight.layovers.map((l) => l.airport).join(", ")})`}
          </div>
        </div>

        {/* Right: Price */}
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            ${flight.price}
          </div>
          <div className="text-xs text-gray-500">{flight.currency}</div>
        </div>
      </div>

      {/* Layover details */}
      {flight.layovers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex gap-4 text-xs text-gray-500">
            {flight.layovers.map((l, i) => (
              <span key={i}>
                {l.airport}: {Math.floor(l.duration_minutes / 60)}h{" "}
                {l.duration_minutes % 60}m layover
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(datetime: string): string {
  // Handle "2026-03-25 07:15" format
  const timePart = datetime.split(" ")[1];
  if (!timePart) return datetime;
  return timePart.slice(0, 5);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/flight-card.tsx
git commit -m "feat: add flight card component with price and route display"
```

---

### Task 10: Flight Results Component

**Files:**
- Create: `src/components/flight-results.tsx`

- [ ] **Step 1: Write the component**

Create file `src/components/flight-results.tsx`:
```tsx
import type { LegSearchResult } from "@/lib/types";
import { FlightCard } from "./flight-card";

interface FlightResultsProps {
  legResults: LegSearchResult[];
  summary: string | null;
}

export function FlightResults({
  legResults,
  summary,
}: FlightResultsProps) {
  if (legResults.length === 0) return null;

  return (
    <div className="space-y-8">
      {summary && (
        <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">
            AI Summary
          </h3>
          <p className="text-sm text-purple-700">{summary}</p>
        </div>
      )}

      {legResults.map((legResult, legIndex) => (
        <div key={legIndex}>
          <h3 className="text-lg font-semibold mb-3">
            {legResult.leg.origin} → {legResult.leg.destination}
            <span className="text-sm font-normal text-gray-500 ml-2">
              {legResult.leg.date}
              {legResult.cheapest_price !== null &&
                ` · from $${legResult.cheapest_price}`}
            </span>
          </h3>

          {legResult.error && (
            <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
              {legResult.error}
            </div>
          )}

          {legResult.flights.length === 0 && !legResult.error && (
            <div className="p-3 rounded bg-yellow-50 text-yellow-700 text-sm">
              No flights found for this leg.
            </div>
          )}

          <div className="space-y-3">
            {legResult.flights.slice(0, 5).map((flight, i) => (
              <FlightCard
                key={i}
                flight={flight}
                isCheapest={i === 0}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/flight-results.tsx
git commit -m "feat: add flight results component with leg grouping"
```

---

### Task 11: Search Bar Component

**Files:**
- Create: `src/components/search-bar.tsx`

- [ ] **Step 1: Write the component**

Create file `src/components/search-bar.tsx`:
```tsx
"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
    }
  };

  const examples = [
    "Cheapest flight from Bangkok to London on March 23, no UAE stopovers",
    "BKK to CNX one way, cheapest day in late March",
    "Shenzhen to London via Shanghai, flexible dates March 25-30",
  ];

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe your trip... e.g. 'cheapest flight from Bangkok to London, no UAE'"
          className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example, i) => (
          <button
            key={i}
            onClick={() => setQuery(example)}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search-bar.tsx
git commit -m "feat: add search bar with example queries"
```

---

## Chunk 5: Main Page & Integration

### Task 12: Main Page (Wire Everything Together)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace content of `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlightsManager — AI-Powered Flight Search",
  description:
    "Find the cheapest flights with natural language search powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Write main page**

Replace content of `src/app/page.tsx`:
```tsx
"use client";

import { useState, useCallback } from "react";
import { SearchBar } from "@/components/search-bar";
import { StreamStatus } from "@/components/stream-status";
import { FlightResults } from "@/components/flight-results";
import type { LegSearchResult, StreamEvent } from "@/lib/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [legResults, setLegResults] = useState<LegSearchResult[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setStatusMessage("Starting search...");
    setLegResults([]);
    setSummary(null);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);

          try {
            const event: StreamEvent = JSON.parse(json);

            switch (event.type) {
              case "status":
                setStatusMessage(event.message);
                break;
              case "leg_result":
                setLegResults((prev) => [...prev, event.data]);
                break;
              case "summary":
                setSummary(event.text);
                break;
              case "error":
                setError(event.message);
                break;
              case "done":
                setStatusMessage("");
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  }, []);

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          FlightsManager
        </h1>
        <p className="text-lg text-gray-500">
          AI-powered flight search. Describe your trip in plain English.
        </p>
      </div>

      <SearchBar onSearch={handleSearch} isLoading={isLoading} />

      <div className="max-w-3xl mx-auto mt-8 space-y-6">
        {statusMessage && (
          <StreamStatus message={statusMessage} isActive={isLoading} />
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        <FlightResults legResults={legResults} summary={summary} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: wire up main page with streaming search integration"
```

---

### Task 13: Environment Setup & Manual Test

**Files:**
- Create: `.env.local` (from template, not committed)

- [ ] **Step 1: Create .env.local from template**

```bash
cp .env.local.example .env.local
```

Then fill in real values:
- `AZURE_OPENAI_API_KEY` — from Azure AI Foundry
- `AZURE_OPENAI_ENDPOINT` — from Azure AI Foundry
- `AZURE_OPENAI_DEPLOYMENT` — model deployment name
- `SERPAPI_API_KEY` — from serpapi.com

- [ ] **Step 2: Add .env.local to .gitignore**

Verify `.env.local` is in `.gitignore` (Next.js adds this by default).

```bash
grep ".env.local" .gitignore
```

Expected: `.env*.local` is listed

- [ ] **Step 3: Start dev server and test**

```bash
npm run dev
```

Open http://localhost:3000 in browser. Test with:
- "cheapest flight from Shenzhen to London, no UAE stopovers"
- "Bangkok to Chiang Mai, late March"

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete POC integration and manual testing"
```

---

## Chunk 6: Azure Deployment

### Task 14: Deploy to Azure Static Web Apps

- [ ] **Step 1: Install Azure SWA CLI**

```bash
npm install -D @azure/static-web-apps-cli
```

- [ ] **Step 2: Create swa-cli.config.json**

Create file `swa-cli.config.json`:
```json
{
  "configurations": {
    "flightsmanager": {
      "appLocation": ".",
      "outputLocation": ".next",
      "appBuildCommand": "npm run build",
      "run": "npm run dev",
      "appDevserverUrl": "http://localhost:3000"
    }
  }
}
```

- [ ] **Step 3: Test locally with SWA emulator**

```bash
npx swa start
```

Expected: App runs at http://localhost:4280 with API routes working

- [ ] **Step 4: Deploy to Azure**

```bash
npx swa deploy --env production
```

Follow prompts to authenticate and select/create Azure resource.

- [ ] **Step 5: Set environment variables in Azure portal**

In Azure Portal → Static Web App → Configuration → Application Settings:
- Add `AZURE_OPENAI_API_KEY`
- Add `AZURE_OPENAI_ENDPOINT`
- Add `AZURE_OPENAI_DEPLOYMENT`
- Add `AZURE_OPENAI_API_VERSION`
- Add `SERPAPI_API_KEY`

- [ ] **Step 6: Verify production deployment**

Open the deployed URL and test a search query.

- [ ] **Step 7: Commit deployment config**

```bash
git add swa-cli.config.json package.json
git commit -m "feat: add Azure Static Web Apps deployment config"
```
