# FlightsManager PWA — Mobile Design

**Date:** 2026-03-24
**Status:** Approved

## Goal

Convert the existing Next.js FlightsManager web app into a fully installable, mobile-first PWA with offline read access and a native-feeling UI.

## Scope

1. Service worker + offline support
2. Mobile UI overhaul with bottom tab navigation

---

## Service Worker & Offline

**Library:** `next-pwa` — integrates with Next.js build pipeline to auto-generate a service worker.

**Caching strategy:**
- Static assets (JS, CSS, fonts, icons): **cache-first**
- Chat history and pinned items: already persisted in `localStorage` — readable offline without additional caching
- API routes (`/api/chat`, `/api/profile`): **network-only** — no caching; these require a live connection

**Offline behavior:**
- When `navigator.onLine === false`, show a slim banner at the top: _"You're offline. Past results are available below."_
- Banner disappears automatically when connectivity is restored
- New flight/hotel searches are blocked with an inline message; past chats and pinned items remain fully accessible
- No special IndexedDB or API response caching needed — all read content already lives in localStorage

---

## Navigation

**Structure:** Two-tab bottom bar

| Tab | Icon | Content |
|-----|------|---------|
| Chat | 💬 | Main AI chat interface (default) |
| Pinned | 📌 | Pinned flights and hotels |

**Rules:**
- Chat tab is active on launch
- Chat component stays **mounted** when switching to Pinned — no state loss, no remounting
- The existing slide-up `PinnedFlightsDrawer` is **replaced** by the Pinned tab

**Header (slimmed for mobile):**
- Left: Dark mode toggle
- Center: "FlightsManager" title
- Right: Currency selector | Profile icon | Share | New (only when messages exist)

---

## Mobile UI

- Bottom tab bar respects safe area insets (iPhone home bar, Android nav bar) using `env(safe-area-inset-bottom)`
- Chat input fixed to bottom of screen, sitting above the tab bar
- All interactive touch targets minimum **44×44px**
- Tab bar height: ~56px + safe area

---

## Offline Indicator Component

- Thin banner (e.g. `bg-yellow-100 text-yellow-800`) rendered at the top of the layout
- Listens to `window` `online` / `offline` events
- No user action required — appears and disappears automatically

---

## What Changes

| Area | Before | After |
|------|--------|-------|
| Service worker | None | `next-pwa` generated |
| Navigation | Single page + slide-up drawer | Two-tab bottom bar |
| Pinned items | Slide-up drawer | Dedicated Pinned tab |
| Offline | App fails silently | Banner + read-only mode |
| Touch targets | Web defaults | Min 44px |
| Safe area | Not handled | `env(safe-area-inset-*)` |

---

## Out of Scope

- Push notifications
- Background sync
- React Native / Expo migration (deferred)
- IndexedDB or advanced cache strategies

---

## Files Affected

- `next.config.ts` — add `next-pwa` wrapper
- `src/app/layout.tsx` — add offline banner, bottom tab bar, safe area padding
- `src/app/page.tsx` — remove `PinnedFlightsDrawer`, adjust layout for tab context
- `src/components/bottom-nav.tsx` — new component
- `src/components/offline-banner.tsx` — new component
- `src/app/pinned/page.tsx` — new page for Pinned tab
- `public/manifest.json` — already exists, no changes needed
