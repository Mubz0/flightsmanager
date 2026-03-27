# Firestore Sync — Design Spec

**Date:** 2026-03-27
**Project:** TripPilot
**Status:** Approved

---

## Goal

Sync chat history, travel profile, and active chat across devices using Firestore as the source of truth, replacing manual localStorage management with Firestore's native offline persistence.

---

## Data Model

```
users/{uid}/profile                            ← TravelProfile fields (flat document)
users/{uid}/sessions/{sessionId}               ← metadata: title, createdAt, updatedAt
users/{uid}/sessions/{sessionId}/messages/{id} ← individual UIMessage docs (subcollection)
```

Active chat is held in React state during streaming. It is flushed to Firestore only when the stream completes (`onFinish`). If the tab closes mid-stream, the incomplete response is lost — this matches standard industry behaviour.

localStorage is retained **only** for UI preferences (dark mode, currency). All chat data moves to Firestore's IndexedDB-backed offline cache.

---

## Architecture

### Firestore Init

Initialise Firestore with `persistentLocalCache()` (modular v9+ SDK). This gives:
- Instant offline reads from IndexedDB on repeat visits
- Automatic write queuing when offline, syncing on reconnect
- No custom conflict resolution needed

### Sync Boundaries

| Data | Write trigger | Notes |
|------|--------------|-------|
| Profile | On every AI extraction update, debounced 2s | Flat doc merge |
| Session metadata | When user clicks "New chat" | title + timestamps only |
| Session messages | On "New chat" — flush active messages subcollection | One doc per message |
| Active chat | `onFinish` callback only — never during streaming | Full message written once complete |

### Sign-in Flow

On `onAuthStateChanged` → user present:
1. Read `users/{uid}/profile` from Firestore (offline cache returns instantly if cached)
2. Read `users/{uid}/sessions` ordered by `createdAt desc`, limit 50
3. Load messages for the most recent active session if present
4. Populate React state — no localStorage reads for chat data

### Migration

On first sign-in (Firestore profile is empty doc):
- If localStorage has chat history or profile, migrate to Firestore then clear localStorage chat keys
- Keeps existing data for users upgrading from the localStorage version

---

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/sessions/{sessionId}/messages/{messageId} {
      allow create: if request.auth.uid == userId
                    && request.resource.data.role in ['user', 'assistant', 'system', 'data']
                    && request.resource.data.content.size() < 20000;
      allow update: if request.auth.uid == userId
                    && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if request.auth.uid == userId;
    }
  }
}
```

---

## Files

### New
- `src/lib/firestore.ts` — Firestore init (with offline persistence) + typed read/write helpers:
  - `saveProfile(uid, profile)`
  - `loadProfile(uid)`
  - `saveSession(uid, session, messages)` — writes metadata doc + message subcollection
  - `loadSessions(uid)` — returns session metadata list
  - `loadMessages(uid, sessionId)` — returns messages for a session
  - `deleteSession(uid, sessionId)` — deletes session + messages subcollection
  - `migrateFromLocalStorage(uid)` — one-time migration helper

### Modified
- `src/lib/firebase.ts` — no change needed
- `src/app/page.tsx` — replace localStorage calls with Firestore helpers; add `onFinish` to `useChat`; run migration on first sign-in
- `src/lib/travel-profile.ts` — remove `PROFILE_STORAGE_KEY` usage (keep type only)

### Unchanged
- `src/components/side-panel.tsx` — no change, receives same props
- `src/contexts/auth-context.tsx` — no change
- localStorage keys `trippilot-dark` and `trippilot-chat` (currency) — kept for UI prefs

---

## Error Handling

- Firestore writes are fire-and-forget with `.catch(console.error)` — UI never blocks on sync
- If Firestore is unreachable and cache is cold, app shows empty state (no crash)
- Migration failure is non-fatal — log and continue

---

## Out of Scope

- Real-time cross-tab sync (`onSnapshot` listeners)
- Shared/collaborative sessions
- Server-side Firestore Admin SDK usage
- Pagination beyond 50 sessions
