import { generateText, jsonSchema } from "ai";
import { getAzureOpenAI, getDeploymentName } from "@/lib/openai";
import { FLIGHT_SEARCH_TOOL, parseIntentFromToolCall } from "@/lib/intent-parser";
import { searchFlights } from "@/lib/serpapi";
import { filterFlights } from "@/lib/flight-filter";
import type { LegSearchResult, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function sendEvent(controller: ReadableStreamDefaultController, event: StreamEvent) {
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
    return Response.json({ error: "SERPAPI_API_KEY not configured" }, { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sendEvent(controller, { type: "status", message: "Parsing your trip..." });

        const azure = getAzureOpenAI();
        const model = azure(getDeploymentName());

        const { toolCalls } = await generateText({
          model,
          tools: {
            search_flights: {
              description: FLIGHT_SEARCH_TOOL.function.description,
              inputSchema: jsonSchema(FLIGHT_SEARCH_TOOL.function.parameters as never),
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
          sendEvent(controller, { type: "error", message: "Could not understand the search query. Please try again." });
          sendEvent(controller, { type: "done" });
          controller.close();
          return;
        }

        const intent = parseIntentFromToolCall(JSON.stringify(toolCalls[0].input));

        const legPromises = intent.legs.map(async (leg) => {
          sendEvent(controller, { type: "status", message: `Searching ${leg.origin} → ${leg.destination} (${leg.date})...` });

          const dates = generateDateRange(leg.date, leg.date_flexibility || 0);

          try {
            const allFlights = await Promise.all(
              dates.map((d) => searchFlights(leg.origin, leg.destination, d, serpApiKey, intent.cabin_class))
            );
            let flights = allFlights.flat();
            flights = filterFlights(flights, {
              excludedAirports: intent.excluded_stopover_airports,
              maxStops: intent.max_stops,
            });

            const result: LegSearchResult = {
              leg, flights,
              cheapest_price: flights.length > 0 ? Math.min(...flights.map((f) => f.price)) : null,
            };
            sendEvent(controller, { type: "leg_result", data: result });
            return result;
          } catch (error) {
            const result: LegSearchResult = {
              leg, flights: [], cheapest_price: null,
              error: error instanceof Error ? error.message : "Search failed",
            };
            sendEvent(controller, { type: "leg_result", data: result });
            return result;
          }
        });

        const results = await Promise.all(legPromises);

        sendEvent(controller, { type: "status", message: "Summarizing best options..." });

        const summaryData = results.map((r) => ({
          route: `${r.leg.origin} → ${r.leg.destination}`,
          date: r.leg.date,
          cheapest: r.cheapest_price ? `$${r.cheapest_price}` : "No flights found",
          options: r.flights.slice(0, 3).map((f) => ({
            airline: f.airline, price: `$${f.price}`,
            duration: `${Math.floor(f.duration_minutes / 60)}h ${f.duration_minutes % 60}m`,
            stops: f.stops, layovers: f.layovers.map((l) => l.airport).join(", "),
          })),
        }));

        const { text: summary } = await generateText({
          model,
          prompt: `Summarize these flight search results concisely. Highlight the best value options and any notable trade-offs (price vs duration vs stops). Keep it brief — 3-4 sentences max.\n\n${JSON.stringify(summaryData, null, 2)}`,
        });

        sendEvent(controller, { type: "summary", text: summary });
        sendEvent(controller, { type: "done" });
      } catch (error) {
        sendEvent(controller, { type: "error", message: error instanceof Error ? error.message : "An unexpected error occurred" });
        sendEvent(controller, { type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

function generateDateRange(centerDate: string, flexibility: number): string[] {
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
