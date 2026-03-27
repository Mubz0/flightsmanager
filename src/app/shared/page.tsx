"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { decompressFromEncodedURIComponent } from "lz-string";
import type { UIMessage } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat-message";

function SharedContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const data = searchParams.get("data");
    if (!data) { setError(true); return; }
    try {
      const json = decompressFromEncodedURIComponent(data);
      if (!json) { setError(true); return; }
      setMessages(JSON.parse(json));
    } catch { setError(true); }
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <p className="text-gray-500">Invalid or expired share link.</p>
        <a href="/" className="mt-4 text-blue-600 underline text-sm">Start a new search</a>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

export default function SharedPage() {
  return (
    <main className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="w-20" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">TripPilot</h1>
          <p className="text-xs text-gray-500">Shared itinerary</p>
        </div>
        <div className="w-20 flex justify-end">
          <a href="/" className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            New search
          </a>
        </div>
      </div>
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>}>
        <SharedContent />
      </Suspense>
    </main>
  );
}
