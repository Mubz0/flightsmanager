# TripPilot Rebrand Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app from "FlightsManager" to "TripPilot" across all UI text, metadata, and localStorage keys.

**Architecture:** Pure string-replacement pass across 8 files. No functional code changes. localStorage key renames will clear existing user sessions on next load — acceptable at this stage.

**Tech Stack:** Next.js 16, TypeScript, browser localStorage

**Spec:** `docs/superpowers/specs/2026-03-27-trippilot-rebrand-design.md`

---

## Chunk 1: Core metadata and manifest

### Task 1: Update root layout metadata

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update all metadata fields**

Replace the entire `metadata` export with:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://app-flightsmanager.azurewebsites.net"),
  title: "TripPilot — Your AI travel agent",
  description: "Plan flights and hotels with a conversational AI travel agent. Compare prices, explore destinations, and get personalised recommendations.",
  keywords: ["flights", "hotels", "cheap flights", "AI travel agent", "flight search", "hotel search", "travel", "accommodation"],
  authors: [{ name: "TripPilot" }],
  openGraph: {
    title: "TripPilot — Your AI travel agent",
    description: "Ask in plain English. Get the cheapest flights and hotels. Your AI-powered travel agent.",
    type: "website",
    siteName: "TripPilot",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TripPilot — Your AI travel agent",
    description: "Ask in plain English. Get the cheapest flights and hotels.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TripPilot",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "rebrand: update root layout metadata to TripPilot"
```

---

### Task 2: Update shared layout metadata

**Files:**
- Modify: `src/app/shared/layout.tsx`

- [ ] **Step 1: Update all metadata fields**

```typescript
export const metadata: Metadata = {
  title: "Shared Itinerary — TripPilot",
  description: "View a shared travel itinerary and continue planning with AI.",
  openGraph: {
    title: "Shared Itinerary — TripPilot",
    description: "Someone shared a travel itinerary with you. Click to view and continue planning.",
    type: "website",
    siteName: "TripPilot",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shared Itinerary — TripPilot",
    description: "Someone shared a travel itinerary with you. Click to view and continue planning.",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shared/layout.tsx
git commit -m "rebrand: update shared layout metadata to TripPilot"
```

---

### Task 3: Update OpenGraph image

**Files:**
- Modify: `src/app/shared/opengraph-image.tsx`

- [ ] **Step 1: Update display text and alt**

Change:
```typescript
export const alt = "FlightsManager — Shared Itinerary";
```
To:
```typescript
export const alt = "TripPilot — Shared Itinerary";
```

Change the heading text inside the JSX:
```tsx
// line 24 — change:
FlightsManager
// to:
TripPilot
```

Change the subheading:
```tsx
// line 27 — change:
AI Travel Agent
// to:
Your AI travel agent
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shared/opengraph-image.tsx
git commit -m "rebrand: update OG image text to TripPilot"
```

---

### Task 4: Update PWA manifest

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Update name, short_name and description**

```json
{
  "name": "TripPilot",
  "short_name": "TripPilot",
  "description": "AI-powered flight and hotel search. Your AI travel agent.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "rebrand: update PWA manifest to TripPilot"
```

---

## Chunk 2: UI text and localStorage keys

### Task 5: Update main page UI text and storage keys

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rename localStorage key constants (lines 14-16)**

```typescript
const STORAGE_KEY = "trippilot-chat";
const PROFILE_KEY = "trippilot-profile";
const HISTORY_KEY = "trippilot-history";
```

- [ ] **Step 2: Rename dark mode key (line 103 and 160)**

Change all occurrences of `"flightsmanager-dark"` → `"trippilot-dark"`

- [ ] **Step 3: Update heading text (line 239)**

```tsx
<h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">TripPilot</h1>
```

- [ ] **Step 4: Update any other FlightsManager display text in this file**

Search for remaining `FlightsManager` occurrences (line 336) and replace with `TripPilot`.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "rebrand: update page.tsx UI text and localStorage keys to TripPilot"
```

---

### Task 6: Update shared page UI text

**Files:**
- Modify: `src/app/shared/page.tsx`

- [ ] **Step 1: Replace FlightsManager display text**

Find line 50:
```tsx
<h1 className="text-xl font-bold text-gray-900">FlightsManager</h1>
```
Change to:
```tsx
<h1 className="text-xl font-bold text-gray-900">TripPilot</h1>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/shared/page.tsx
git commit -m "rebrand: update shared page heading to TripPilot"
```

---

### Task 7: Update travel profile storage key

**Files:**
- Modify: `src/lib/travel-profile.ts`

- [ ] **Step 1: Rename storage key constant (line 14)**

```typescript
export const PROFILE_STORAGE_KEY = "trippilot-profile";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/travel-profile.ts
git commit -m "rebrand: update travel profile storage key to trippilot"
```

---

### Task 8: Update package.json name

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update name field**

```json
{
  "name": "trippilot",
  ...
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "rebrand: update package name to trippilot"
```

---

## Chunk 3: Verification

### Task 9: Verify no FlightsManager references remain in src

- [ ] **Step 1: Search for remaining references**

```bash
grep -r "FlightsManager\|flightsmanager" src/ public/manifest.json package.json --include="*.ts" --include="*.tsx" --include="*.json"
```

Expected: no matches (only the Azure URL in layout.tsx metadataBase is acceptable to leave as-is — that's an infrastructure URL, not a brand name).

- [ ] **Step 2: Run the app and verify**

```bash
npm run dev
```

Open `http://localhost:3000` and confirm:
- Page title shows "TripPilot — Your AI travel agent"
- Header shows "TripPilot"
- Browser tab shows correct title

- [ ] **Step 3: Final commit if any fixes needed, then tag**

```bash
git add -A
git commit -m "rebrand: final cleanup"
```
