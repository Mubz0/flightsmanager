import { searchFlights } from "@/lib/serpapi";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { origin, destination, date, currency = "USD" } = await req.json();

    if (!origin || !destination || !date) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return Response.json({ error: "SERPAPI_KEY not configured" }, { status: 500 });
    }

    const result = await searchFlights(origin, destination, date, apiKey, undefined, undefined, currency);
    const cheapest = result.flights.length > 0 ? result.flights[0].price : null;

    return Response.json({ price: cheapest });
  } catch (err) {
    console.error("price-check error:", err);
    return Response.json({ price: null });
  }
}
