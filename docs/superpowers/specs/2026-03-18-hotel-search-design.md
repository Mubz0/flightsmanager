# Hotel Search Feature Design

## Summary

Add Google Hotels search to FlightsManager as an independent tool alongside existing flight search. Users can ask about hotels/accommodation and get visual hotel cards with images, ratings, prices, amenities, and booking links. Hotels support pin-to-compare in the same drawer as flights.

## Architecture: Mirror Flights Pattern (Approach A)

Hotels follow the same architecture as flights — separate SerpApi client, separate tool, separate card component. The city-code map is extracted to a shared module. Pin context is refactored to hold flights and hotels in separate arrays.

## Data Layer

### New: `src/lib/serpapi-hotels.ts`

- `searchHotels(query, checkIn, checkOut, apiKey, opts?)` calls SerpApi `engine=google_hotels`
- Own LRU cache instance (30min TTL, 200 entries)
- Cache key: `query-checkIn-checkOut-adults-currency`
- Normalizes SerpApi response into `HotelResult[]`
- Supports filters: `adults`, `minPrice`/`maxPrice`, `hotelClass`, `rating`, `sortBy`, `freeCancellation`

### New: `src/lib/types-hotels.ts`

```typescript
interface HotelResult {
  name: string;
  address: string;
  hotelClass: number;          // 2-5 stars
  overallRating: number;       // e.g. 4.6
  reviewCount: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  amenities: string[];
  thumbnail: string;           // image URL
  bookingLink: string;         // Google Hotels URL
  propertyToken: string;
  checkIn: string;             // YYYY-MM-DD
  checkOut: string;            // YYYY-MM-DD
}
```

### Extract: `src/lib/city-codes.ts`

Move `CITY_AIRPORT_MAP` and `expandCityCode()` from `serpapi.ts` into a shared module. Both flight and hotel clients import from here.

## Tool Layer

### New tool: `searchHotelsTool`

Input schema:
- `q` (string, required) — location/city name (e.g. "London", "Bali")
- `checkInDate` (string, required) — YYYY-MM-DD
- `checkOutDate` (string, required) — YYYY-MM-DD
- `adults` (number, optional) — defaults to 2
- `currency` (string, optional) — defaults to USD
- `maxPrice` (number, optional) — max price per night
- `hotelClass` (string, optional) — e.g. "4,5" for 4-5 star
- `minRating` (number, optional) — minimum overall rating
- `freeCancellation` (boolean, optional)
- `sortBy` (enum, optional) — "lowest_price" | "highest_rating" | "most_reviewed"

Returns up to 8 hotel results sorted by price. Same structured no-results/error pattern as searchFlightsTool.

### System prompt addition

New section in route.ts system prompt:
- "Use searchHotels when user asks about hotels, accommodation, places to stay, or lodging"
- "Do NOT proactively suggest hotels after flight searches — only when explicitly asked"
- "Always require check-in and check-out dates. If missing, ask."

## UI Layer

### New: `src/components/hotel-card.tsx`

- Thumbnail image with placeholder fallback
- Hotel name + star rating (filled star icons)
- Overall rating badge + review count
- Price per night (bold) + total price (smaller)
- Top 4-5 amenity chips (e.g. "Free Wi-Fi", "Pool")
- "View on Google Hotels" booking link button
- Pin button (same pattern as flight cards)
- Dark mode support matching flight-card styling

### Update: `src/components/chat-message.tsx`

- Detect `searchHotels` tool results → render `HotelCard` components
- Same pattern as existing `searchFlights` → `FlightCard` rendering

### Update: `src/components/pin-context.tsx`

- Refactor from single `pinnedFlights` array to:
  - `pinnedFlights: FlightResult[]`
  - `pinnedHotels: HotelResult[]`
- Separate methods: `pinFlight`/`unpinFlight`/`isFlightPinned` and `pinHotel`/`unpinHotel`/`isHotelPinned`
- Backward-compatible with existing flight pin consumers

### Update: `src/components/pinned-flights.tsx`

- Add hotels section below flights in the pinned drawer
- Show cheapest hotel + best-rated hotel summary alongside cheapest/fastest flight summary
- Rename file to `pinned-items.tsx` or keep and extend

## SerpApi Parameters Reference

Required: `engine=google_hotels`, `api_key`, `q`, `check_in_date`, `check_out_date`
Optional: `adults`, `currency`, `sort_by` (3=lowest price, 8=highest rating, 13=most reviewed), `min_price`, `max_price`, `hotel_class`, `rating` (7=3.5+, 8=4.0+, 9=4.5+), `free_cancellation`, `hl`, `gl`

Response: `properties[]` with `name`, `rate_per_night.extracted_lowest`, `total_rate.extracted_lowest`, `overall_rating`, `reviews`, `extracted_hotel_class`, `amenities[]`, `images[].thumbnail`, `link`, `property_token`, `gps_coordinates`.
