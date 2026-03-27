"use client";

import type { User } from "firebase/auth";
import type { UIMessage } from "@ai-sdk/react";

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: UIMessage[];
}

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  user: User;
  dark: boolean;
  onToggleDark: () => void;
  currency: string;
  onChangeCurrency: (c: string) => void;
  history: ChatSession[];
  historySearch: string;
  onHistorySearch: (q: string) => void;
  filteredHistory: ChatSession[];
  onLoadSession: (s: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onSignOut: () => void;
  hasProfile: boolean;
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "THB", "CNY", "AUD", "CAD", "SGD", "INR"];

export function SidePanel({
  open, onClose, user, dark, onToggleDark, currency, onChangeCurrency,
  history, historySearch, onHistorySearch, filteredHistory,
  onLoadSession, onDeleteSession, onSignOut, hasProfile,
}: SidePanelProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* User profile */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName ?? "User"} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
              {(user.displayName?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user.displayName ?? user.email?.split("@")[0] ?? "User"}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          {hasProfile && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 shrink-0">
              Profile
            </span>
          )}
        </div>

        {/* Settings */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Settings</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Dark mode</span>
            <button
              onClick={onToggleDark}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${dark ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
              style={{ height: "22px" }}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dark ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Currency</span>
            <select
              value={currency}
              onChange={(e) => onChangeCurrency(e.target.value)}
              className="text-xs text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1 border-none outline-none cursor-pointer"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Chat history */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-2">Chat history</p>
            <div className="relative">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => onHistorySearch(e.target.value)}
                placeholder="Search…"
                className="w-full text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 rounded-lg px-3 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-blue-400"
              />
              {historySearch && (
                <button
                  onClick={() => onHistorySearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
                >×</button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {history.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center">No past chats</p>
            ) : filteredHistory.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center">No matches</p>
            ) : filteredHistory.map((session) => (
              <div key={session.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 group">
                <button
                  onClick={() => { onLoadSession(session); onClose(); }}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-xs text-gray-800 dark:text-gray-200 truncate">{session.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(session.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
                <button
                  onClick={() => onDeleteSession(session.id)}
                  className="text-[10px] text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >Delete</button>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onSignOut}
            className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-left"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
