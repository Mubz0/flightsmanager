import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Itinerary — TripPilot",
  description: "View a shared travel itinerary and continue planning with AI.",
  openGraph: {
    title: "Shared Flight Itinerary — TripPilot",
    description: "Someone shared flight options with you. Click to view and continue planning.",
    type: "website",
    siteName: "TripPilot",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shared Flight Itinerary — TripPilot",
    description: "Someone shared flight options with you. Click to view and continue planning.",
  },
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
