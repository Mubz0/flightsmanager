"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface BottomNavProps {
  pinnedCount: number;
}

export function BottomNav({ pinnedCount }: BottomNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Chat", icon: ChatIcon },
    { href: "/pinned", label: "Pinned", icon: PinIcon },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        const isPin = href === "/pinned";
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors relative min-h-[56px] ${
              active
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <span className="relative">
              <Icon className="w-6 h-6" />
              {isPin && pinnedCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {pinnedCount}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
    </svg>
  );
}
