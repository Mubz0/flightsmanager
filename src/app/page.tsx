"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { InstallPrompt } from "@/components/install-prompt";
import { PriceAlerts } from "@/components/price-alerts";
import { compressToEncodedURIComponent } from "lz-string";
import type { TravelProfile } from "@/lib/travel-profile";
import { useAuth } from "@/contexts/auth-context";
import { signOut } from "@/lib/auth";
import {
  fsLoadProfile, fsSaveProfile,
  fsLoadSessions, fsLoadMessages,
  fsSaveSession, fsDeleteSession,
  fsSaveActiveChat, fsLoadActiveChat, fsClearActiveChat,
  migrateFromLocalStorage,
} from "@/lib/firestore";
import { AuthScreen } from "@/components/auth-screen";
import { SidePanel } from "@/components/side-panel";

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: UIMessage[];
}

const EXAMPLE_PROMPTS = [
  "Cheapest flight from Bangkok to London on April 15",
  "Round trip SFO to Tokyo, Apr 28 returning May 5",
  "Multi-city: LHR to BKK on May 1, BKK to SYD on May 8, SYD to LHR on May 15",
  "I have $800 and a week off — somewhere warm from JFK",
];

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
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
    onFinish: () => {
      const currentUser = userRef.current;
      if (currentUser && messagesRef.current.length > 0) {
        fsSaveActiveChat(currentUser.uid, messagesRef.current).catch(console.error);
      }
    },
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const extractingRef = useRef(false);
  const messagesRef = useRef<UIMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Reset restore flag when user changes so new user gets fresh data
  useEffect(() => {
    restoredRef.current = false;
  }, [user]);

  // Restore data from Firestore on mount (after auth loads)
  useEffect(() => {
    if (!user || restoredRef.current) return;
    restoredRef.current = true;

    // UI prefs from localStorage (never moved to Firestore)
    const savedDark = localStorage.getItem("trippilot-dark") === "true";
    setDark(savedDark);
    if (savedDark) document.documentElement.classList.add("dark");

    const savedCurrency = localStorage.getItem("trippilot-currency");
    if (savedCurrency) { setCurrency(savedCurrency); currencyRef.current = savedCurrency; }

    (async () => {
      await migrateFromLocalStorage(user.uid);

      const [fsProfile, activeMessages, sessions] = await Promise.all([
        fsLoadProfile(user.uid),
        fsLoadActiveChat(user.uid),
        fsLoadSessions(user.uid),
      ]);

      setProfile(fsProfile);
      profileRef.current = fsProfile;

      if (activeMessages.length > 0) setMessages(activeMessages);

      setHistory(sessions.map((s) => ({
        id: s.id,
        title: s.title,
        timestamp: s.createdAt,
        messages: [],
      })));
    })();
  }, [user, setMessages]);

  // Crash-recovery: flush active chat on page hide / tab close
  useEffect(() => {
    if (!user) return;
    const flush = () => {
      if (messagesRef.current.length > 0) {
        fsSaveActiveChat(user.uid, messagesRef.current).catch(console.error);
      }
    };
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user]);

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
                if (user) fsSaveProfile(user.uid, merged).catch(console.error);
                profileRef.current = merged;
                return merged;
              });
            }
          })
          .catch(() => {})
          .finally(() => { extractingRef.current = false; });
      }
    }
  }, [messages, isLoading, user]);

  // Auto-scroll to bottom on new messages/streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleChangeCurrency = useCallback((c: string) => {
    setCurrency(c);
    currencyRef.current = c;
    localStorage.setItem("trippilot-currency", c);
  }, []);

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("trippilot-dark", String(next));
      return next;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    const current = messagesRef.current;
    if (current.length > 0 && user) {
      const firstUserMsg = current.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (firstUserMsg.parts?.find((p) => p.type === "text")?.text ?? "Chat").slice(0, 60)
        : "Chat";
      const now = Date.now();
      const sessionId = `${now}-${Math.random().toString(36).slice(2, 7)}`;
      // Save session first, then clear active chat to avoid data loss on race
      fsSaveSession(user.uid, { id: sessionId, title, createdAt: now, updatedAt: now }, current)
        .then(() => fsClearActiveChat(user.uid))
        .catch(console.error);
      setHistory((prev) => [{ id: sessionId, title, timestamp: now, messages: [] }, ...prev]);
    }
    setMessages([]);
    clearError();
  }, [setMessages, clearError, user]);

  const handleLoadSession = useCallback(async (session: ChatSession) => {
    if (!user) return;
    // Save current active chat before switching sessions
    const current = messagesRef.current;
    if (current.length > 0) {
      fsSaveActiveChat(user.uid, current).catch(console.error);
    }
    const msgs = session.messages.length > 0
      ? session.messages
      : await fsLoadMessages(user.uid, session.id);
    setMessages(msgs);
    if (msgs.length > 0) fsSaveActiveChat(user.uid, msgs).catch(console.error);
    setShowPanel(false);
  }, [setMessages, user]);

  const handleDeleteSession = useCallback((id: string) => {
    if (user) fsDeleteSession(user.uid, id).catch(console.error);
    setHistory((prev) => prev.filter((s) => s.id !== id));
  }, [user]);

  const [showPanel, setShowPanel] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [historySearch, setHistorySearch] = useState("");

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter((s) => s.title.toLowerCase().includes(q));
  }, [history, historySearch]);

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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-white dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <main className="flex flex-col h-dvh relative">
      {/* Side panel */}
      <SidePanel
        open={showPanel}
        onClose={() => setShowPanel(false)}
        user={user}
        dark={dark}
        onToggleDark={toggleDark}
        currency={currency}
        onChangeCurrency={handleChangeCurrency}
        history={history}
        historySearch={historySearch}
        onHistorySearch={setHistorySearch}
        filteredHistory={filteredHistory}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onSignOut={signOut}
        hasProfile={hasProfile}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="w-8 h-8 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Menu"
        >
          <span className="w-4 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full" />
          <span className="w-4 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full" />
          <span className="w-4 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full" />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">TripPilot</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">AI travel agent</p>
        </div>
        <div className="flex justify-end items-center gap-1 w-8">
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center px-4 py-10 max-w-md mx-auto w-full">
              {/* App name + tagline */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                TripPilot
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Search real flights in plain English
              </p>

              {/* Capability cards */}
              <div className="mt-8 w-full grid grid-cols-2 gap-3">
                {[
                  {
                    title: "Search flights",
                    desc: "Ask naturally, get real prices from live data",
                  },
                  {
                    title: "Flexible dates",
                    desc: "Find the cheapest day or week to fly",
                  },
                  {
                    title: "Explore destinations",
                    desc: "Give me a budget — I'll find somewhere great",
                  },
                  {
                    title: "Round trips",
                    desc: "Search outbound and return in one message",
                  },
                ].map(({ title, desc }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3"
                  >
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{title}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Example prompt chips */}
              <p className="mt-8 text-xs text-gray-400 dark:text-gray-500 mb-3">Try an example:</p>
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

      <InstallPrompt />
      <PriceAlerts />

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
