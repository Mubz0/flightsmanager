"use client";

import { useState, useCallback } from "react";
import { SearchBar } from "@/components/search-bar";
import { StreamStatus } from "@/components/stream-status";
import { FlightResults } from "@/components/flight-results";
import type { LegSearchResult, StreamEvent } from "@/lib/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [legResults, setLegResults] = useState<LegSearchResult[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setStatusMessage("Starting search...");
    setLegResults([]);
    setSummary(null);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          try {
            const event: StreamEvent = JSON.parse(json);
            switch (event.type) {
              case "status": setStatusMessage(event.message); break;
              case "leg_result": setLegResults((prev) => [...prev, event.data]); break;
              case "summary": setSummary(event.text); break;
              case "error": setError(event.message); break;
              case "done": setStatusMessage(""); break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  }, []);

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">FlightsManager</h1>
        <p className="text-lg text-gray-500">AI-powered flight search. Describe your trip in plain English.</p>
      </div>
      <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      <div className="max-w-3xl mx-auto mt-8 space-y-6">
        {statusMessage && <StreamStatus message={statusMessage} isActive={isLoading} />}
        {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>}
        <FlightResults legResults={legResults} summary={summary} />
      </div>
    </main>
  );
}
