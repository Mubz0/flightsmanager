"use client";

import { useChat } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";

const EXAMPLE_PROMPTS = [
  "Cheapest flight from Bangkok to London on March 23, no UAE stopovers",
  "BKK to CNX one way, cheapest day in late March",
  "Shenzhen to London via Shanghai, flexible dates March 25-30",
];

export default function Home() {
  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <main className="flex flex-col h-screen">
      <div className="text-center py-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">FlightsManager</h1>
        <p className="text-sm text-gray-500">AI travel agent. Ask about flights in plain English.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-6">Try one of these:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage({ text: prompt })}
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && messages.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="h-3 w-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              Thinking...
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={(text) => sendMessage({ text })}
            isLoading={isLoading}
          />
        </div>
      </div>
    </main>
  );
}
