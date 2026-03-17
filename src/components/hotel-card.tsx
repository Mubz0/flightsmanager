import type { HotelResult } from "@/lib/types-hotels";

interface HotelCardProps {
  hotel: HotelResult;
  isCheapest?: boolean;
  onPin?: (hotel: HotelResult) => void;
  isPinned?: boolean;
}

export function HotelCard({ hotel, isCheapest, onPin, isPinned }: HotelCardProps) {
  const nights = getNights(hotel.checkIn, hotel.checkOut);

  return (
    <div className={`relative rounded-lg border overflow-hidden ${isCheapest ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"} hover:shadow-md transition-shadow`}>
      {isCheapest && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">CHEAPEST</span>
      )}
      <div className="flex flex-col sm:flex-row">
        {hotel.thumbnail && (
          <div className="sm:w-40 sm:flex-shrink-0 h-36 sm:h-auto">
            <img
              src={hotel.thumbnail}
              alt={hotel.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{hotel.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {hotel.hotelClass > 0 && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    {"★".repeat(hotel.hotelClass)}
                  </span>
                )}
                {hotel.overallRating > 0 && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${hotel.overallRating >= 4.5 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : hotel.overallRating >= 4 ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                    {hotel.overallRating.toFixed(1)}
                  </span>
                )}
                {hotel.reviewCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({hotel.reviewCount.toLocaleString()} reviews)
                  </span>
                )}
              </div>
              {hotel.address && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{hotel.address}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatPrice(hotel.pricePerNight, hotel.currency)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">/night</div>
              {hotel.totalPrice > 0 && nights > 1 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatPrice(hotel.totalPrice, hotel.currency)} total · {nights} nights
                </div>
              )}
            </div>
          </div>
          {hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hotel.amenities.slice(0, 5).map((amenity, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-full">
                  {amenity}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            {onPin && (
              <button
                onClick={() => onPin(hotel)}
                className={`px-2 py-1.5 text-xs rounded-lg transition-colors ${isPinned ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" : "bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-700 dark:bg-gray-800 dark:text-gray-400"}`}
                title={isPinned ? "Pinned" : "Pin to compare"}
              >
                {isPinned ? "Pinned" : "Pin"}
              </button>
            )}
            {hotel.bookingLink && (
              <a
                href={hotel.bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View on Google Hotels
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch { return `${currency} ${price}`; }
}

function getNights(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}
