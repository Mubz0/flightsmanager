"use client";

import { useState } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { FlightCard } from "./flight-card";
import { SkeletonCard } from "./skeleton-card";
import { usePins } from "./pin-context";
import type { FlightResult } from "@/lib/types";

// Simple markdown-to-JSX: bold, links, and line breaks
function renderMarkdown(text: string) {
  // Split by newlines first, then process inline markdown
  return text.split("\n").map((line, lineIdx, arr) => (
    <span key={lineIdx}>
      {processInline(line)}
      {lineIdx < arr.length - 1 && <br />}
    </span>
  ));
}

function processInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch)
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          {linkMatch[1]}
        </a>
      );
    return <span key={i}>{part}</span>;
  });
}

interface ChatMessageProps {
  message: UIMessage;
}

// Map pruned tool output to FlightResult for FlightCard
function toFlightResult(pruned: any): FlightResult {
  return {
    airline: pruned.airline || "",
    flight_number: pruned.flight_number || "",
    departure_time: pruned.departure_time || "",
    arrival_time: pruned.arrival_time || "",
    duration_minutes: pruned.duration_minutes || 0,
    origin: "",
    destination: "",
    stops: pruned.stops || 0,
    layovers: (pruned.layovers || []).map((l: any) =>
      typeof l === "string" ? { airport: l, city: "", country: "", duration_minutes: 0 } : l
    ),
    price: pruned.price || 0,
    currency: pruned.currency || "USD",
    cabin_class: "",
    departure_date: pruned.departure_date,
    google_flights_url: pruned.google_flights_url,
    trip_type: pruned.trip_type,
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text) return null;
          return (
            <div key={i} className="max-w-[80%] px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
              {renderMarkdown(part.text)}
            </div>
          );
        }
        if (part.type === "step-start") return null;

        // Handle tool parts (dynamic-tool or tool-*)
        if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
          const toolName =
            part.type === "dynamic-tool"
              ? (part as any).toolName
              : part.type.replace("tool-", "");
          const isDone = (part as any).state === "output-available";
          const input = (part as any).input;
          const output = (part as any).output;
          return (
            <ToolInvocationView
              key={i}
              toolName={toolName}
              input={input}
              output={output}
              isDone={isDone}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function ToolInvocationView({
  toolName,
  input,
  output,
  isDone,
}: {
  toolName: string;
  input: any;
  output: any;
  isDone: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { pin, isPinned } = usePins();

  const label =
    toolName === "searchFlights"
      ? `Searching ${input?.origin} → ${input?.destination}`
      : toolName === "findAlternativeDates"
        ? `Checking dates around ${input?.baseDate}`
        : toolName === "resolveNearbyAirports"
          ? `Looking up airports: ${input?.query}`
          : toolName === "exploreDestinations"
            ? `Exploring ${input?.destinations?.length || ""} destinations from ${input?.origin}`
            : toolName;

  // searchFlights: show skeleton while pending, flight cards when done
  if (toolName === "searchFlights") {
    if (!isDone) {
      return (
        <div className="space-y-2">
          <ThinkingStepHeader label={label} isDone={false} expanded={false} onToggle={() => {}} />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );
    }
    if (Array.isArray(output)) {
      const priceInsightsEntry = output.find((item: any) => item._price_insights);
      const priceInsights = priceInsightsEntry?._price_insights;
      const flights = output.filter((item: any) => !item._price_insights).map(toFlightResult);
      return (
        <div className="space-y-2">
          <ThinkingStepHeader
            label={label}
            isDone
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
          />
          {expanded && (
            <div className="pl-4 text-xs text-gray-400">Found {flights.length} flights</div>
          )}
          {priceInsights && <PriceInsightsBadge insights={priceInsights} />}
          <div className="space-y-2">
            {flights.slice(0, 5).map((flight, j) => (
              <FlightCard key={j} flight={flight} isCheapest={j === 0} onPin={pin} isPinned={isPinned(flight)} />
            ))}
          </div>
        </div>
      );
    }
    // Structured no-results or error response
    if (output && typeof output === "object" && output.status) {
      return (
        <div className="space-y-2">
          <ThinkingStepHeader label={label} isDone expanded={expanded} onToggle={() => setExpanded(!expanded)} />
          {output.status === "no_results" && (
            <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
              No matching flights found{output.cheapest_available ? ` (cheapest available: $${output.cheapest_available})` : ""}
            </div>
          )}
        </div>
      );
    }
  }

  // For other tools or pending state
  return (
    <div>
      <ThinkingStepHeader
        label={label}
        isDone={isDone}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && isDone && (
        <div className="pl-4 mt-1 text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-32 overflow-auto">
          <pre className="whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ThinkingStepHeader({
  label,
  isDone,
  expanded,
  onToggle,
}: {
  label: string;
  isDone: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
    >
      {!isDone && (
        <span className="h-3 w-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      )}
      {isDone && <span className="text-green-500">&#10003;</span>}
      <span>{label}</span>
      {isDone && <span className="text-gray-300">{expanded ? "▲" : "▼"}</span>}
    </button>
  );
}

function PriceInsightsBadge({ insights }: { insights: { price_level?: string; typical_price_range?: [number, number]; lowest_price?: number } }) {
  const level = insights.price_level?.toLowerCase();
  const colors = level === "low" ? "bg-green-50 text-green-700 border-green-200"
    : level === "high" ? "bg-red-50 text-red-700 border-red-200"
    : "bg-blue-50 text-blue-700 border-blue-200";
  const label = level === "low" ? "Good deal" : level === "high" ? "Prices are high" : "Typical prices";
  const range = insights.typical_price_range;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border ${colors}`}>
      <span className="font-medium">{label}</span>
      {range && <span>Typical: ${range[0]}–${range[1]}</span>}
    </div>
  );
}
