# Firestore Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync chat history, travel profile, and active chat to Firestore so TripPilot data is available across all of a user's devices.

**Architecture:** Firestore with native offline persistence (`persistentLocalCache()`) replaces manual localStorage management for all chat data. Messages are stored as a subcollection under each session doc. Active chat is held in React state during streaming and flushed to Firestore only on `onFinish` (plus crash-recovery on `pagehide`). localStorage is kept only for UI prefs (dark mode, currency).

**Tech Stack:** Next.js 16, Firebase 11 (Firestore modular v9+), TypeScript, React

**Spec:** `docs/superpowers/specs/2026-03-27-firestore-sync-design.md`

---

## Chunk 1: Firestore init + helpers

### Task 1: Enable Firestore in Firebase console + set security rules

**Files:**
- No code changes — browser automation task

- [ ] **Step 1: Enable Firestore**

Navigate to `https://console.firebase.google.com/project/trippilot-9a610/firestore` in Chrome and click "Create database". Choose **production mode**, region **europe-west2** (closest to Azure app-flightsmanager which is UK South), click Enable.

- [ ] **Step 2: Set security rules**

In the Firestore console → Rules tab, replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/profile/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /messages/{messageId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create: if request.auth != null
                      && request.auth.uid == userId
                      && request.resource.data.role in ['user', 'assistant', 'system', 'data', 'tool']
                      && request.resource.data.content.size() < 20000;
        allow update: if request.auth != null
                      && request.auth.uid == userId
                      && request.resource.data.createdAt == resource.data.createdAt;
        allow delete: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /users/{userId}/activeChat/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click "Publish".

---

### Task 2: Create `src/lib/firestore.ts`

**Files:**
- Create: `src/lib/firestore.ts`

This file initialises Firestore with offline persistence and exports typed read/write helpers. It is the only file that imports from `firebase/firestore`.

Key fixes from review:
- Module-level singleton guard for `getDb()` with warning log on fallback
- `fsSaveSession` uses `writeBatch` with deterministic message IDs (not sequential `addDoc`)
- All Firestore writes are fire-and-forget (no `await` blocking the UI)

- [ ] **Step 1: Create the file**

```typescript
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp } from "./firebase";
import type { TravelProfile } from "./travel-profile";
import type { UIMessage } from "@ai-sdk/react";

// ── Singleton init with offline persistence ───────────────────────────────────

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;
  if (typeof window === "undefined") {
    _db = getFirestore(firebaseApp);
    return _db;
  }
  try {
    _db = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Already initialised (HMR) or persistence unavailable (Safari private mode)
    console.warn("[TripPilot] Firestore offline persistence unavailable, falling back to memory cache");
    _db = getFirestore(firebaseApp);
  }
  return _db;
}

export const db = getDb();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredMessage {
  id: string;
  role: string;
  content: string;
  createdAt: number;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function fsLoadProfile(uid: string): Promise<TravelProfile> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "profile", "data"));
    return snap.exists() ? (snap.data() as TravelProfile) : {};
  } catch (e) {
    console.error("[TripPilot] fsLoadProfile", e);
    return {};
  }
}

export async function fsSaveProfile(uid: string, profile: TravelProfile): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid, "profile", "data"), profile, { merge: true });
  } catch (e) {
    console.error("[TripPilot] fsSaveProfile", e);
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function fsLoadSessions(uid: string): Promise<SessionMeta[]> {
  try {
    const q = query(
      collection(db, "users", uid, "sessions"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SessionMeta));
  } catch (e) {
    console.error("[TripPilot] fsLoadSessions", e);
    return [];
  }
}

export async function fsLoadMessages(uid: string, sessionId: string): Promise<UIMessage[]> {
  try {
    const q = query(
      collection(db, "users", uid, "sessions", sessionId, "messages"),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as StoredMessage;
      return {
        id: data.id,
        role: data.role as UIMessage["role"],
        parts: [{ type: "text" as const, text: data.content }],
      } as UIMessage;
    });
  } catch (e) {
    console.error("[TripPilot] fsLoadMessages", e);
    return [];
  }
}

export async function fsSaveSession(
  uid: string,
  meta: SessionMeta,
  messages: UIMessage[]
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Session metadata
    batch.set(doc(db, "users", uid, "sessions", meta.id), {
      title: meta.title,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    });

    // Messages — deterministic IDs (message.id) so writes are idempotent
    const BATCH_LIMIT = 490; // Firestore batch cap is 500 ops; leave headroom
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const content =
        msg.parts?.find((p) => p.type === "text")?.text ??
        (typeof (msg as any).content === "string" ? (msg as any).content : "");
      batch.set(
        doc(db, "users", uid, "sessions", meta.id, "messages", msg.id),
        { id: msg.id, role: msg.role, content, createdAt: meta.createdAt + i } satisfies StoredMessage
      );
      // Commit and start new batch every BATCH_LIMIT ops
      if ((i + 1) % BATCH_LIMIT === 0) {
        await batch.commit();
      }
    }

    await batch.commit();
  } catch (e) {
    console.error("[TripPilot] fsSaveSession", e);
  }
}

export async function fsDeleteSession(uid: string, sessionId: string): Promise<void> {
  try {
    const msgsSnap = await getDocs(
      collection(db, "users", uid, "sessions", sessionId, "messages")
    );
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "users", uid, "sessions", sessionId));
    await batch.commit();
  } catch (e) {
    console.error("[TripPilot] fsDeleteSession", e);
  }
}

// ── Active chat ───────────────────────────────────────────────────────────────

export async function fsSaveActiveChat(uid: string, messages: UIMessage[]): Promise<void> {
  try {
    const stored: StoredMessage[] = messages.map((msg, i) => ({
      id: msg.id,
      role: msg.role,
      content:
        msg.parts?.find((p) => p.type === "text")?.text ??
        (typeof (msg as any).content === "string" ? (msg as any).content : ""),
      createdAt: i,
    }));
    await setDoc(doc(db, "users", uid, "activeChat", "current"), { messages: stored });
  } catch (e) {
    console.error("[TripPilot] fsSaveActiveChat", e);
  }
}

export async function fsLoadActiveChat(uid: string): Promise<UIMessage[]> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "activeChat", "current"));
    if (!snap.exists()) return [];
    const { messages } = snap.data() as { messages: StoredMessage[] };
    return messages.map((m) => ({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: [{ type: "text" as const, text: m.content }],
    } as UIMessage));
  } catch (e) {
    console.error("[TripPilot] fsLoadActiveChat", e);
    return [];
  }
}

export async function fsClearActiveChat(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "users", uid, "activeChat", "current"));
  } catch (e) {
    console.error("[TripPilot] fsClearActiveChat", e);
  }
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * One-time migration: if Firestore profile is empty and localStorage has data,
 * write localStorage data to Firestore then clear the localStorage chat keys.
 */
export async function migrateFromLocalStorage(uid: string): Promise<void> {
  try {
    // Only migrate if no Firestore profile exists yet
    const fsProfile = await fsLoadProfile(uid);
    if (Object.keys(fsProfile).length > 0) return;

    // Check if there's anything to migrate
    const rawProfile = localStorage.getItem("trippilot-profile");
    const rawHistory = localStorage.getItem("trippilot-history");
    const rawChat = localStorage.getItem("trippilot-chat");
    if (!rawProfile && !rawHistory && !rawChat) return;

    if (rawProfile) {
      await fsSaveProfile(uid, JSON.parse(rawProfile));
    }

    if (rawHistory) {
      const history: Array<{ id: string; title: string; timestamp: number; messages: UIMessage[] }> =
        JSON.parse(rawHistory);
      for (const session of history.slice(0, 50)) {
        await fsSaveSession(
          uid,
          { id: session.id, title: session.title, createdAt: session.timestamp, updatedAt: session.timestamp },
          session.messages
        );
      }
    }

    if (rawChat) {
      const messages: UIMessage[] = JSON.parse(rawChat);
      if (messages.length > 0) await fsSaveActiveChat(uid, messages);
    }

    // Clear localStorage chat keys (keep UI prefs)
    localStorage.removeItem("trippilot-profile");
    localStorage.removeItem("trippilot-history");
    localStorage.removeItem("trippilot-chat");

    console.log("[TripPilot] Migrated localStorage data to Firestore");
  } catch (e) {
    console.error("[TripPilot] migrateFromLocalStorage", e);
    // Non-fatal — migration failure is logged and ignored
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: add Firestore helpers with offline persistence and batch writes"
```

---

## Chunk 2: Wire Firestore into page.tsx

### Task 3: Replace localStorage with Firestore in `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`

Read the entire file before editing.

Key fixes from review:
- `onFinish` uses a `messagesRef` (not the closure value) to avoid stale state bug
- `pagehide` event listener flushes active chat for crash recovery
- All history loading happens via Firestore on mount

- [ ] **Step 1: Add Firestore imports**

After the existing imports, add:

```typescript
import {
  fsLoadProfile, fsSaveProfile,
  fsLoadSessions, fsLoadMessages,
  fsSaveSession, fsDeleteSession,
  fsSaveActiveChat, fsLoadActiveChat, fsClearActiveChat,
  migrateFromLocalStorage,
} from "@/lib/firestore";
```

- [ ] **Step 2: Remove old localStorage constant declarations**

Find and delete these three lines:

```typescript
const STORAGE_KEY = "trippilot-chat";
const PROFILE_KEY = "trippilot-profile";
const HISTORY_KEY = "trippilot-history";
```

- [ ] **Step 3: Remove the four localStorage helper functions**

Find and delete the `loadHistory()`, `saveHistory()`, `loadMessages()`, and `saveMessages()` function definitions (all four are before the `Home` component). They are fully replaced by Firestore helpers.

- [ ] **Step 4: Add `messagesRef` to track latest messages (stale closure fix)**

Inside the `Home` component, after the existing `const extractingRef = useRef(false);` line, add:

```typescript
  const messagesRef = useRef<typeof messages>([]);
```

Then add a `useEffect` to keep it current, right after that line:

```typescript
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
```

- [ ] **Step 5: Update `useChat` to use `messagesRef` in `onFinish`**

Find:
```typescript
  const { messages, sendMessage, status, setMessages, stop, error, clearError } = useChat({
    transport,
  });
```

Replace with:
```typescript
  const { messages, sendMessage, status, setMessages, stop, error, clearError } = useChat({
    transport,
    onFinish: () => {
      if (user && messagesRef.current.length > 0) {
        fsSaveActiveChat(user.uid, messagesRef.current).catch(console.error);
      }
    },
  });
```

- [ ] **Step 6: Replace the restore-on-mount `useEffect`**

Find:
```typescript
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
      const savedDark = localStorage.getItem("trippilot-dark") === "true";
      setDark(savedDark);
      if (savedDark) document.documentElement.classList.add("dark");
    }
  }, [setMessages]);
```

Replace with:
```typescript
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
        messages: [], // loaded on demand when session is opened
      })));
    })();
  }, [user, setMessages]);
```

- [ ] **Step 7: Add `pagehide` crash-recovery save**

After the restore `useEffect`, add a new `useEffect`:

```typescript
  // Crash-recovery: flush active chat on page hide / tab close
  useEffect(() => {
    if (!user) return;
    const flush = () => {
      if (messagesRef.current.length > 0) {
        fsSaveActiveChat(user.uid, messagesRef.current).catch(console.error);
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, [user]);
```

- [ ] **Step 8: Delete the persist-messages `useEffect`**

Find and delete:
```typescript
  // Persist messages to localStorage when they change (skip while streaming)
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isLoading]);
```

- [ ] **Step 9: Update profile save in the extraction `useEffect`**

Inside the extraction `useEffect`, find:
```typescript
                saveProfile(merged);
```

Replace with:
```typescript
                if (user) fsSaveProfile(user.uid, merged).catch(console.error);
```

Also find `loadProfile()` if it appears anywhere in the extraction effect and remove it (it shouldn't — the profile is already in React state).

- [ ] **Step 10: Replace `handleNewChat`**

Find:
```typescript
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
```

Replace with:
```typescript
  const handleNewChat = useCallback(() => {
    const current = messagesRef.current;
    if (current.length > 0 && user) {
      const firstUserMsg = current.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (firstUserMsg.parts?.find((p) => p.type === "text")?.text ?? "Chat").slice(0, 60)
        : "Chat";
      const now = Date.now();
      const sessionId = now.toString();
      fsSaveSession(user.uid, { id: sessionId, title, createdAt: now, updatedAt: now }, current)
        .catch(console.error);
      fsClearActiveChat(user.uid).catch(console.error);
      setHistory((prev) => [{ id: sessionId, title, timestamp: now, messages: [] }, ...prev]);
    }
    setMessages([]);
    clearError();
  }, [setMessages, clearError, user]);
```

- [ ] **Step 11: Replace `handleLoadSession`**

Find:
```typescript
  const handleLoadSession = useCallback((session: ChatSession) => {
    setMessages(session.messages);
    saveMessages(session.messages);
    setShowHistory(false);
  }, [setMessages]);
```

Replace with:
```typescript
  const handleLoadSession = useCallback(async (session: ChatSession) => {
    if (!user) return;
    const msgs = session.messages.length > 0
      ? session.messages
      : await fsLoadMessages(user.uid, session.id);
    setMessages(msgs);
    if (msgs.length > 0) fsSaveActiveChat(user.uid, msgs).catch(console.error);
  }, [setMessages, user]);
```

- [ ] **Step 12: Replace `handleDeleteSession`**

Find:
```typescript
  const handleDeleteSession = useCallback((id: string) => {
    const updated = loadHistory().filter((s) => s.id !== id);
    saveHistory(updated);
    setHistory(updated);
  }, []);
```

Replace with:
```typescript
  const handleDeleteSession = useCallback((id: string) => {
    if (user) fsDeleteSession(user.uid, id).catch(console.error);
    setHistory((prev) => prev.filter((s) => s.id !== id));
  }, [user]);
```

- [ ] **Step 13: Remove the history-load `useEffect`**

Find and delete:
```typescript
  useEffect(() => {
    setHistory(loadHistory());
  }, []);
```

History is now loaded inside the Firestore restore effect.

- [ ] **Step 14: Persist currency to localStorage**

In the `SidePanel` `onChangeCurrency` prop, find:
```typescript
        onChangeCurrency={(c) => { setCurrency(c); currencyRef.current = c; }}
```

Replace with:
```typescript
        onChangeCurrency={(c) => { setCurrency(c); currencyRef.current = c; localStorage.setItem("trippilot-currency", c); }}
```

- [ ] **Step 15: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace localStorage with Firestore sync for chat and profile"
```

---

## Chunk 3: Build + deploy

### Task 4: Build check + deploy

- [ ] **Step 1: TypeScript build check**

```bash
cd /Users/developer/flightsmanager && npm run build 2>&1 | tail -30
```

Expected: clean build, no TypeScript errors. Common errors to fix:
- `loadProfile` / `saveProfile` / `loadHistory` / `saveHistory` no longer exist — remove any remaining calls
- `STORAGE_KEY` / `PROFILE_KEY` / `HISTORY_KEY` no longer defined — remove any remaining references
- `setShowHistory` is no longer used — remove it and its `useState`

- [ ] **Step 2: Deploy**

```bash
git remote set-url origin https://REDACTED_PAT@github.com/Mubz0/flightsmanager.git
git push origin main
git remote set-url origin https://github.com/Mubz0/flightsmanager.git
```

Expected: GitHub Actions build + deploy succeeds.

- [ ] **Step 3: Smoke test**

Open `https://app-flightsmanager.azurewebsites.net/` in a browser, sign in, send a message, sign in from a different browser — verify chat history and profile appear.
