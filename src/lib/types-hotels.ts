export interface HotelResult {
  name: string;
  address: string;
  hotelClass: number;
  overallRating: number;
  reviewCount: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  amenities: string[];
  thumbnail: string;
  bookingLink: string;
  propertyToken: string;
  checkIn: string;
  checkOut: string;
}
