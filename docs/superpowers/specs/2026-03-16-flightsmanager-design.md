# FlightsManager — POC Design Spec

## Overview

A flight search platform that uses Azure OpenAI to parse natural language queries into multi-leg flight searches, returning real Google Flights prices via SerpApi. Users type queries like "cheapest way from Bangkok to London via China, flexible dates, no UAE" and get structured, real-time results.

## Architecture

### Single Codebase: Next.js on Azure Static Web Apps

```
User
  ↓
Next.js (Azure Static Web Apps) — $0 hosting
├── Frontend: "Magic Search" bar + traditional form + Flight Cards
└── API Routes (serverless):
    ├── Azure OpenAI gpt-4o-mini (parse intent via Function Calling)
    ├── SerpApi Google Flights × N legs (concurrent via Promise.all)
    ├── Post-processing (filter stopovers, sort by price)
    └── Stream results back via SSE (real-time progress)
```

### Azure AI Foundry Role
- Provision and manage Azure OpenAI model deployments (gpt-4o-mini)
- API key management and rotation
- Content safety filters
- Token usage monitoring and tracing
- NOT used for Prompt Flow orchestration (handled in Next.js for simplicity)

## Core Features (POC)

### 1. Natural Language Intent Parsing
- Azure OpenAI gpt-4o-mini with Function Calling
- Extracts: origins, destinations, dates, exclusions, flexibility, cabin class
- Converts city names to IATA codes
- Maps "late March" to specific anchor date ± 2 days
- Decomposes complex trips into individual flight legs

### 2. Multi-Leg Flight Search
- Each leg searched concurrently via Promise.all()
- SerpApi Google Flights endpoint per leg
- Returns real, current prices with airline, duration, stopovers

### 3. Stopover Filtering
- Post-process SerpApi results
- Exclude flights with layovers in specified countries/airports
- e.g., exclude DXB, AUH, DOH for "no UAE/Qatar"

### 4. Streaming UX (SSE)
- Real-time progress updates to frontend
- States: "Parsing your trip..." → "Searching BKK→CNX..." → "Found 5 flights..." → "Summarizing..."
- Keeps connection alive during 15-20s multi-leg searches
- Azure OpenAI generates conversational summary of best options

### 5. Frontend
- "Magic Search" text input for natural language queries
- Traditional form fallback (origin, destination, date pickers)
- Flight result cards: airline, price, duration, stops, layover details
- Sorted by price with best value highlighted
- Responsive design (Tailwind CSS)

## Function Calling Schema

```json
{
  "name": "search_flights",
  "description": "Search for flights based on parsed user intent",
  "parameters": {
    "type": "object",
    "properties": {
      "legs": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "origin": { "type": "string", "description": "IATA airport code" },
            "destination": { "type": "string", "description": "IATA airport code" },
            "date": { "type": "string", "description": "YYYY-MM-DD" },
            "date_flexibility": { "type": "number", "description": "Days ± to search" }
          },
          "required": ["origin", "destination", "date"]
        }
      },
      "excluded_stopover_airports": {
        "type": "array",
        "items": { "type": "string" },
        "description": "IATA codes of airports to exclude as stopovers"
      },
      "excluded_stopover_countries": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Countries to exclude as stopover locations"
      },
      "cabin_class": {
        "type": "string",
        "enum": ["economy", "premium_economy", "business", "first"],
        "description": "Cabin class preference"
      },
      "max_stops": {
        "type": "number",
        "description": "Maximum number of stops per leg"
      },
      "preferred_airlines": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Preferred airline IATA codes"
      }
    },
    "required": ["legs"]
  }
}
```

## Tech Stack

| Component | Technology | Cost (POC) |
|-----------|-----------|------------|
| Frontend | Next.js (App Router) + Tailwind CSS | $0 |
| Hosting | Azure Static Web Apps | $0 (free tier) |
| AI | Azure OpenAI gpt-4o-mini (via Vercel AI SDK) | ~$1-5/mo |
| Flight Data | SerpApi Google Flights | $50/mo (dev plan) |
| AI Management | Azure AI Foundry | Included with Azure OpenAI |
| **Total** | | **~$50-55/mo** |

## API Flow (Detailed)

```
1. User types: "cheapest flight from Shenzhen to London late March, via China not UAE"
2. Next.js API route receives request, opens SSE stream
3. Stream: "Parsing your trip..."
4. Call Azure OpenAI with Function Calling schema
   → Returns: { legs: [{ origin: "SZX", destination: "LON", date: "2026-03-25", date_flexibility: 2 }],
                 excluded_stopover_airports: ["DXB", "AUH", "DOH"],
                 preferred_airlines: ["MU", "CZ", "CA", "ZH"] }
5. Stream: "Searching SZX → London (Mar 23-27)..."
6. Call SerpApi for each date in range (concurrent)
7. Filter results: remove flights with DXB/AUH/DOH layovers
8. Sort by price
9. Stream: "Found 12 flights, summarizing..."
10. Call Azure OpenAI to generate conversational summary
11. Stream: final results + summary to frontend
```

## Scaling Path (Post-POC)

| Concern | POC | Scale |
|---------|-----|-------|
| Flight API | SerpApi (100-5000 searches/mo) | Amadeus / Duffel / Skyscanner enterprise API |
| Caching | None | Azure Redis Cache (cache identical searches) |
| Rate Limiting | Simple IP-based | Azure API Management + Upstash Redis |
| Auth | None (POC) | Azure Entra ID / NextAuth.js |
| Monitoring | AI Foundry dashboard | Application Insights + AI Foundry |
| Multi-region | Single region | Azure Front Door + multi-region SWA |

## Error Handling

- Empty results: LLM prompted to suggest alternatives (different dates, nearby airports)
- SerpApi failure: Graceful error with retry suggestion
- LLM parsing failure: Fall back to traditional form
- Rate limit: User-friendly message with retry timer

## Out of Scope (POC)

- User accounts / saved searches
- Booking integration
- Price tracking / alerts
- Mobile app
- Multi-currency conversion
- Hotel / car rental bundling
