"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";

const EXAMPLE_PROMPTS = [
  "Cheapest flight from Bangkok to London on March 23, no UAE stopovers",
  "BKK to CNX one way, cheapest day in late March",
  "Shenzhen to London via Shanghai, flexible dates March 25-30",
];

export default function Home() {
  const { messages, sendMessage, status, setMessages, stop, error, clearError } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages/streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleNewChat = () => {
    setMessages([]);
    clearError();
  };

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="w-20" />
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">FlightsManager</h1>
          <p className="text-xs text-gray-500">AI travel agent</p>
        </div>
        <div className="w-20 flex justify-end">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
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
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              Something went wrong. Please try again.
              <button
                onClick={clearError}
                className="ml-2 text-red-500 underline text-xs"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={(text) => sendMessage({ text })}
            onStop={stop}
            isLoading={isLoading}
          />
        </div>
      </div>
    </main>
  );
}
