"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { compressToEncodedURIComponent } from "lz-string";
import type { TravelProfile } from "@/lib/travel-profile";

const STORAGE_KEY = "flightsmanager-chat";
const PROFILE_KEY = "flightsmanager-profile";
const HISTORY_KEY = "flightsmanager-history";

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: UIMessage[];
}

function loadHistory(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(history: ChatSession[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch { /* quota exceeded */ }
}

const EXAMPLE_PROMPTS = [
  "Cheapest flight from Bangkok to London on March 23",
  "Round trip SFO to Tokyo, Mar 28 returning Apr 5",
  "I have $800 and a week off — somewhere warm from JFK",
];

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMessages(messages: UIMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch { /* quota exceeded */ }
}

function loadProfile(): TravelProfile {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProfile(profile: TravelProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch { /* quota exceeded */ }
}

export default function Home() {
  const [profile, setProfile] = useState<TravelProfile>({});
  const profileRef = useRef<TravelProfile>({});
  const [currency, setCurrency] = useState("USD");
  const currencyRef = useRef("USD");
  const [dark, setDark] = useState(false);
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ travelProfile: profileRef.current, currency: currencyRef.current }),
  }), []);
  const { messages, sendMessage, status, setMessages, stop, error, clearError } = useChat({
    transport,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const extractingRef = useRef(false);

  const isLoading = status === "submitted" || status === "streaming";

  // Restore messages and profile from localStorage on mount
  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = loadMessages();
      if (saved.length > 0) setMessages(saved);
      const savedProfile = loadProfile();
      setProfile(savedProfile);
      profileRef.current = savedProfile;
      // Restore dark mode
      const savedDark = localStorage.getItem("flightsmanager-dark") === "true";
      setDark(savedDark);
      if (savedDark) document.documentElement.classList.add("dark");
    }
  }, [setMessages]);

  // Persist messages to localStorage when they change (skip while streaming)
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isLoading]);

  // Extract profile updates after each assistant response completes
  useEffect(() => {
    if (!isLoading && messages.length >= 2 && !extractingRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "assistant") {
        extractingRef.current = true;
        fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messages.slice(-6) }),
        })
          .then((r) => r.json())
          .then(({ profile: updates }) => {
            if (updates && Object.keys(updates).length > 0) {
              setProfile((prev) => {
                const merged = { ...prev };
                for (const [key, value] of Object.entries(updates)) {
                  if (value === null || value === undefined) continue;
                  if (Array.isArray(value) && (value as any[]).length === 0) continue;
                  (merged as any)[key] = value;
                }
                saveProfile(merged);
                profileRef.current = merged;
                return merged;
              });
            }
          })
          .catch(() => {})
          .finally(() => { extractingRef.current = false; });
      }
    }
  }, [messages, isLoading]);

  // Auto-scroll to bottom on new messages/streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("flightsmanager-dark", String(next));
      return next;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (firstUserMsg.parts?.find((p) => p.type === "text")?.text ?? "Chat").slice(0, 60)
        : "Chat";
      const session: ChatSession = {
        id: Date.now().toString(),
        title,
        timestamp: Date.now(),
        messages,
      };
      const updated = [session, ...loadHistory()];
      saveHistory(updated);
      setHistory(updated);
    }
    setMessages([]);
    clearError();
    localStorage.removeItem(STORAGE_KEY);
  }, [messages, setMessages, clearError]);

  const handleLoadSession = useCallback((session: ChatSession) => {
    setMessages(session.messages);
    saveMessages(session.messages);
    setShowHistory(false);
  }, [setMessages]);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = loadHistory().filter((s) => s.id !== id);
    saveHistory(updated);
    setHistory(updated);
  }, []);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const handleShare = useCallback(() => {
    const compressed = compressToEncodedURIComponent(JSON.stringify(messages));
    const url = `${window.location.origin}/shared?data=${compressed}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    }).catch(() => {
      // Fallback: open in new tab
      window.open(url, "_blank");
    });
  }, [messages]);

  const hasProfile = Object.values(profile).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined
  );

  return (
    <main className="flex flex-col h-dvh relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-20">
          <button onClick={toggleDark} className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {dark ? "Light" : "Dark"}
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">FlightsManager</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI travel agent</p>
        </div>
        <div className="flex justify-end items-center gap-1">
          <select
            value={currency}
            onChange={(e) => { setCurrency(e.target.value); currencyRef.current = e.target.value; }}
            className="px-1.5 py-1 text-[10px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border-none rounded-lg cursor-pointer"
          >
            {["USD", "EUR", "GBP", "JPY", "THB", "CNY", "AUD", "CAD", "SGD", "INR"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {hasProfile && (
            <span className="px-2 py-1 text-[10px] text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 rounded-lg" title="Travel profile active">
              Profile
            </span>
          )}
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              History
            </button>
          )}
          {messages.length > 0 && (
            <>
              <button
                onClick={handleShare}
                className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {shareStatus === "copied" ? "Copied!" : "Share"}
              </button>
              <button
                onClick={handleNewChat}
                className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                New
              </button>
            </>
          )}
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Chat History</h2>
            <button onClick={() => setShowHistory(false)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Close</button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {history.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">No past chats</p>
            ) : history.map((session) => (
              <div key={session.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 group">
                <button onClick={() => handleLoadSession(session)} className="flex-1 text-left">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{session.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(session.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </button>
                <button onClick={() => handleDeleteSession(session.id)} className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <p className="text-gray-400 dark:text-gray-500 mb-6">Try one of these:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage({ text: prompt })}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
      <div className="border-t border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-3">
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
