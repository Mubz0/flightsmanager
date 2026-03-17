import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Itinerary — FlightsManager",
  description: "View a shared flight itinerary and continue planning with AI.",
  openGraph: {
    title: "Shared Flight Itinerary — FlightsManager",
    description: "Someone shared flight options with you. Click to view and continue planning.",
    type: "website",
    siteName: "FlightsManager",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shared Flight Itinerary — FlightsManager",
    description: "Someone shared flight options with you. Click to view and continue planning.",
  },
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
