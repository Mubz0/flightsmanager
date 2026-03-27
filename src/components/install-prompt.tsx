"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  return isIos && isWebkit && !isChrome && !isFirefox;
}

function isInStandaloneMode() {
  return typeof window !== "undefined" && ("standalone" in window.navigator) && (window.navigator as any).standalone;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pwa-install-dismissed")) return;
    if (isInStandaloneMode()) return;

    if (isIosSafari()) {
      setShowIos(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  if (dismissed) return null;

  // iOS Safari: show instructions banner
  if (showIos) {
    return (
      <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4">
        <div className="flex items-start gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-4 py-3 max-w-sm w-full">
          <span className="text-2xl">✈️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Add to home screen</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tap <span className="inline-block">⎙</span> then &ldquo;Add to Home Screen&rdquo;
            </p>
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none shrink-0">
            ×
          </button>
        </div>
      </div>
    );
  }

  // Android/Chrome: native install prompt
  if (!promptEvent) return null;

  const handleInstall = async () => {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setDismissed(true);
      localStorage.setItem("pwa-install-dismissed", "1");
    }
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-4 py-3 max-w-sm w-full">
        <span className="text-2xl">✈️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Add to home screen</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Your AI travel agent</p>
        </div>
        <button onClick={handleInstall} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors shrink-0">
          Install
        </button>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none shrink-0">
          ×
        </button>
      </div>
    </div>
  );
}
