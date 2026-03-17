import { LRUCache } from "lru-cache";
import type { HotelResult } from "./types-hotels";

const hotelCache = new LRUCache<string, HotelSearchResult>({
  max: 200,
  ttl: 30 * 60 * 1000,
});

interface SerpApiHotelProperty {
  type?: string;
  name?: string;
  description?: string;
  link?: string;
  address?: string;
  property_token?: string;
  extracted_hotel_class?: number;
  overall_rating?: number;
  reviews?: number;
  rate_per_night?: { extracted_lowest?: number };
  total_rate?: { extracted_lowest?: number };
  amenities?: string[];
  images?: Array<{ thumbnail?: string; original_image?: string }>;
  gps_coordinates?: { latitude: number; longitude: number };
}

interface SerpApiHotelResponse {
  properties?: SerpApiHotelProperty[];
  search_metadata?: { google_hotels_url?: string };
  search_information?: { hotels_results_state?: string };
  error?: string;
  // Property details mode: when searching for a specific hotel name,
  // SerpApi returns the hotel data at the root level instead of in properties[]
  name?: string;
  link?: string;
  address?: string;
  property_token?: string;
  extracted_hotel_class?: number;
  overall_rating?: number;
  reviews?: number;
  rate_per_night?: { extracted_lowest?: number };
  total_rate?: { extracted_lowest?: number };
  amenities?: string[];
  images?: Array<{ thumbnail?: string; original_image?: string }>;
}

export interface HotelSearchResult {
  hotels: HotelResult[];
}

interface SearchHotelsOpts {
  adults?: number;
  currency?: string;
  minPrice?: number;
  maxPrice?: number;
  hotelClass?: string;
  rating?: number;
  sortBy?: "lowest_price" | "highest_rating" | "most_reviewed";
  freeCancellation?: boolean;
}

function buildHotelUrl(query: string, checkIn: string, checkOut: string, apiKey: string, opts: SearchHotelsOpts = {}): string {
  const { adults = 2, currency = "USD", minPrice, maxPrice, hotelClass, rating, sortBy, freeCancellation } = opts;
  const sp = new URLSearchParams({
    engine: "google_hotels",
    q: query,
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults: String(adults),
    currency,
    hl: "en",
    api_key: apiKey,
  });
  if (minPrice !== undefined) sp.set("min_price", String(minPrice));
  if (maxPrice !== undefined) sp.set("max_price", String(maxPrice));
  if (hotelClass) sp.set("hotel_class", hotelClass);
  if (rating) {
    const ratingMap: Record<number, string> = { 3.5: "7", 4: "8", 4.5: "9" };
    const closest = Object.keys(ratingMap).map(Number).filter((r) => r <= rating).pop();
    if (closest) sp.set("rating", ratingMap[closest]);
  }
  if (sortBy) {
    const sortMap: Record<string, string> = { lowest_price: "3", highest_rating: "8", most_reviewed: "13" };
    sp.set("sort_by", sortMap[sortBy] || "3");
  }
  if (freeCancellation) sp.set("free_cancellation", "true");
  return `https://serpapi.com/search?${sp.toString()}`;
}

function propertyToHotel(p: SerpApiHotelProperty, currency: string, checkIn: string, checkOut: string): HotelResult {
  return {
    name: p.name || "Unknown Hotel",
    address: p.address || "",
    hotelClass: p.extracted_hotel_class || 0,
    overallRating: p.overall_rating || 0,
    reviewCount: p.reviews || 0,
    pricePerNight: p.rate_per_night?.extracted_lowest || 0,
    totalPrice: p.total_rate?.extracted_lowest || 0,
    currency,
    amenities: (p.amenities || []).slice(0, 8),
    thumbnail: p.images?.[0]?.thumbnail || p.images?.[0]?.original_image || "",
    bookingLink: p.link || "",
    propertyToken: p.property_token || "",
    checkIn,
    checkOut,
  };
}

function normalizeHotelResponse(data: SerpApiHotelResponse, currency: string, checkIn: string, checkOut: string): HotelResult[] {
  // Handle property details mode (specific hotel name search)
  const isPropertyDetails = data.search_information?.hotels_results_state === "Showing results for property details"
    || (!data.properties && data.name && data.rate_per_night);

  if (isPropertyDetails && data.name) {
    const hotel = propertyToHotel(data as SerpApiHotelProperty, currency, checkIn, checkOut);
    return hotel.pricePerNight > 0 ? [hotel] : [];
  }

  // Handle normal properties array
  const properties = data.properties || [];
  return properties
    .filter((p) => p.rate_per_night?.extracted_lowest && p.rate_per_night.extracted_lowest > 0)
    .map((p) => propertyToHotel(p, currency, checkIn, checkOut));
}

export async function searchHotels(query: string, checkIn: string, checkOut: string, apiKey: string, opts: SearchHotelsOpts = {}): Promise<HotelSearchResult> {
  const { currency = "USD", adults = 2 } = opts;
  const cacheKey = `${query}-${checkIn}-${checkOut}-${adults}-${currency}`;
  const cached = hotelCache.get(cacheKey);
  if (cached) return cached;

  const url = buildHotelUrl(query, checkIn, checkOut, apiKey, opts);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`SerpApi hotel request failed: ${r.status} ${r.statusText}`);
  const data: SerpApiHotelResponse = await r.json();

  if (data.error) throw new Error(`SerpApi hotel error: ${data.error}`);

  const result: HotelSearchResult = {
    hotels: normalizeHotelResponse(data, currency, checkIn, checkOut),
  };

  hotelCache.set(cacheKey, result);
  return result;
}
