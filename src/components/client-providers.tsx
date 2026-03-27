"use client";

import { PinProvider, usePins } from "@/components/pin-context";
import { OfflineBanner } from "@/components/offline-banner";
import { BottomNav } from "@/components/bottom-nav";
import { AuthProvider } from "@/contexts/auth-context";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

function BottomNavWithPins() {
  const { totalPinned } = usePins();
  return <BottomNav pinnedCount={totalPinned} />;
}
