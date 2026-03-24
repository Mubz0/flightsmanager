"use client";

import { PinProvider, usePins } from "@/components/pin-context";
import { OfflineBanner } from "@/components/offline-banner";
import { BottomNav } from "@/components/bottom-nav";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PinProvider>
      <OfflineBanner />
      <div
        className="flex flex-col"
        style={{
          minHeight: "100dvh",
          paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <BottomNavWithPins />
    </PinProvider>
  );
}

function BottomNavWithPins() {
  const { totalPinned } = usePins();
  return <BottomNav pinnedCount={totalPinned} />;
}
