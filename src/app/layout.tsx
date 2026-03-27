import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/client-providers";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://app-flightsmanager.azurewebsites.net"),
  title: "TripPilot — Your AI travel agent",
  description: "Plan flights and hotels with a conversational AI travel agent. Compare prices, explore destinations, and get personalised recommendations.",
  keywords: ["flights", "cheap flights", "AI travel agent", "flight search", "travel", "flight comparison", "hotels", "accommodation"],
  authors: [{ name: "TripPilot" }],
  openGraph: {
    title: "TripPilot — Your AI travel agent",
    description: "Ask in plain English. Get the cheapest flights. Compare destinations. Your AI-powered travel agent.",
    type: "website",
    siteName: "TripPilot",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TripPilot — Your AI travel agent",
    description: "Ask in plain English. Get the cheapest flights. Compare destinations.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TripPilot",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-[#0a0a0a]`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
