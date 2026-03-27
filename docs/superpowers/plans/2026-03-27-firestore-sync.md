# Firestore Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync chat history, travel profile, and active chat to Firestore so TripPilot data is available across all of a user's devices.

**Architecture:** Firestore with native offline persistence (`persistentLocalCache()`) replaces manual localStorage management for all chat data. Messages are stored as a subcollection under each session doc. Active chat is held in React state during streaming and flushed to Firestore only on `onFinish`. localStorage is kept only for UI prefs (dark mode, currency).

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
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/profile {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/sessions/{sessionId}/messages/{messageId} {
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
}
```

Click "Publish".

---

### Task 2: Create `src/lib/firestore.ts`

**Files:**
- Create: `src/lib/firestore.ts`

This file initialises Firestore with offline persistence and exports typed helpers. It is the only file that imports from `firebase/firestore`.

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
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getApps } from "firebase/app";
import { firebaseApp } from "./firebase";
import type { TravelProfile } from "./travel-profile";
import type { UIMessage } from "@ai-sdk/react";

// ── Initialise with offline persistence ──────────────────────────────────────

function getDb() {
  // persistentLocalCache only works in browser; guard for SSR
  if (typeof window === "undefined") {
    return getFirestore(firebaseApp);
  }
  // initializeFirestore is idempotent if called multiple times it throws,
  // so check if already initialised
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const db = getDb();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredMessage {
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
    console.error("fsLoadProfile", e);
    return {};
  }
}

export async function fsSaveProfile(uid: string, profile: TravelProfile): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid, "profile", "data"), profile, { merge: true });
  } catch (e) {
    console.error("fsSaveProfile", e);
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
    console.error("fsLoadSessions", e);
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
    console.error("fsLoadMessages", e);
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

    // Session metadata doc
    const sessionRef = doc(db, "users", uid, "sessions", meta.id);
    batch.set(sessionRef, {
      title: meta.title,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    });

    await batch.commit();

    // Write messages as individual docs in subcollection
    const messagesRef = collection(db, "users", uid, "sessions", meta.id, "messages");
    for (const msg of messages) {
      const content =
        msg.parts?.find((p) => p.type === "text")?.text ??
        (typeof (msg as any).content === "string" ? (msg as any).content : "");
      await addDoc(messagesRef, {
        id: msg.id,
        role: msg.role,
        content,
        createdAt: Date.now(),
      } satisfies StoredMessage);
    }
  } catch (e) {
    console.error("fsSaveSession", e);
  }
}

export async function fsDeleteSession(uid: string, sessionId: string): Promise<void> {
  try {
    // Delete messages subcollection first
    const msgsSnap = await getDocs(
      collection(db, "users", uid, "sessions", sessionId, "messages")
    );
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "users", uid, "sessions", sessionId));
    await batch.commit();
  } catch (e) {
    console.error("fsDeleteSession", e);
  }
}

// ── Active chat ───────────────────────────────────────────────────────────────

export async function fsSaveActiveChat(uid: string, messages: UIMessage[]): Promise<void> {
  try {
    const stored = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content:
        msg.parts?.find((p) => p.type === "text")?.text ??
        (typeof (msg as any).content === "string" ? (msg as any).content : ""),
      createdAt: Date.now(),
    } satisfies StoredMessage));
    await setDoc(doc(db, "users", uid, "activeChat", "current"), { messages: stored });
  } catch (e) {
    console.error("fsSaveActiveChat", e);
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
    console.error("fsLoadActiveChat", e);
    return [];
  }
}

export async function fsClearActiveChat(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "users", uid, "activeChat", "current"));
  } catch (e) {
    console.error("fsClearActiveChat", e);
  }
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * One-time migration: if Firestore profile is empty and localStorage has data,
 * write localStorage data to Firestore then clear the localStorage chat keys.
 */
export async function migrateFromLocalStorage(uid: string): Promise<void> {
  try {
    const fsProfile = await fsLoadProfile(uid);
    const hasFirestoreData = Object.keys(fsProfile).length > 0;
    if (hasFirestoreData) return; // Already migrated

    // Migrate profile
    const rawProfile = localStorage.getItem("trippilot-profile");
    if (rawProfile) {
      const profile: TravelProfile = JSON.parse(rawProfile);
      await fsSaveProfile(uid, profile);
    }

    // Migrate history
    const rawHistory = localStorage.getItem("trippilot-history");
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

    // Migrate active chat
    const rawChat = localStorage.getItem("trippilot-chat");
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
    console.error("migrateFromLocalStorage", e);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: add Firestore helpers with offline persistence"
```

---

## Chunk 2: Wire Firestore into page.tsx

### Task 3: Replace localStorage with Firestore in `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`

This task replaces localStorage chat/profile reads/writes with Firestore calls and adds `onFinish` to the `useChat` hook for active chat sync.

Read the file before editing. Changes are listed as find-and-replace operations.

- [ ] **Step 1: Add Firestore imports**

After the existing imports at the top of the file, add:

```typescript
import {
  fsLoadProfile, fsSaveProfile,
  fsLoadSessions, fsLoadMessages,
  fsSaveSession, fsDeleteSession,
  fsSaveActiveChat, fsLoadActiveChat, fsClearActiveChat,
  migrateFromLocalStorage,
} from "@/lib/firestore";
```

- [ ] **Step 2: Remove the old localStorage constant declarations**

Find and delete these three lines (they are no longer needed):

```typescript
const STORAGE_KEY = "trippilot-chat";
const PROFILE_KEY = "trippilot-profile";
const HISTORY_KEY = "trippilot-history";
```

- [ ] **Step 3: Remove the four localStorage helper functions**

Find and delete `loadHistory()`, `saveHistory()`, `loadMessages()`, `saveMessages()` — all four functions defined before the `Home` component. They are replaced by Firestore helpers.

- [ ] **Step 4: Replace the restore-on-mount `useEffect`**

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

    // Restore dark mode from localStorage (UI pref only)
    const savedDark = localStorage.getItem("trippilot-dark") === "true";
    setDark(savedDark);
    if (savedDark) document.documentElement.classList.add("dark");

    // Restore currency from localStorage (UI pref only)
    const savedCurrency = localStorage.getItem("trippilot-currency");
    if (savedCurrency) { setCurrency(savedCurrency); currencyRef.current = savedCurrency; }

    (async () => {
      // One-time migration from localStorage → Firestore
      await migrateFromLocalStorage(user.uid);

      // Load profile
      const fsProfile = await fsLoadProfile(user.uid);
      setProfile(fsProfile);
      profileRef.current = fsProfile;

      // Load active chat
      const activeMessages = await fsLoadActiveChat(user.uid);
      if (activeMessages.length > 0) setMessages(activeMessages);

      // Load session history metadata
      const sessions = await fsLoadSessions(user.uid);
      setHistory(sessions.map((s) => ({
        id: s.id,
        title: s.title,
        timestamp: s.createdAt,
        messages: [], // loaded on demand
      })));
    })();
  }, [user, setMessages]);
```

- [ ] **Step 5: Replace the persist-messages `useEffect`**

Find:
```typescript
  // Persist messages to localStorage when they change (skip while streaming)
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isLoading]);
```

Delete this entire `useEffect` block — active chat is now flushed via `onFinish`.

- [ ] **Step 6: Replace the profile save in the extraction `useEffect`**

Inside the extraction `useEffect`, find:
```typescript
                saveProfile(merged);
```

Replace with:
```typescript
                if (user) fsSaveProfile(user.uid, merged).catch(console.error);
```

- [ ] **Step 7: Add `onFinish` to `useChat` for active chat sync**

Find the `useChat` call:
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
      if (user && messages.length > 0) {
        fsSaveActiveChat(user.uid, messages).catch(console.error);
      }
    },
  });
```

- [ ] **Step 8: Replace `handleNewChat` to use Firestore**

Find the `handleNewChat` function:
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
    if (messages.length > 0 && user) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (firstUserMsg.parts?.find((p) => p.type === "text")?.text ?? "Chat").slice(0, 60)
        : "Chat";
      const now = Date.now();
      const sessionId = now.toString();
      const meta = { id: sessionId, title, createdAt: now, updatedAt: now };
      fsSaveSession(user.uid, meta, messages).catch(console.error);
      fsClearActiveChat(user.uid).catch(console.error);
      setHistory((prev) => [{ id: sessionId, title, timestamp: now, messages: [] }, ...prev]);
    }
    setMessages([]);
    clearError();
  }, [messages, setMessages, clearError, user]);
```

- [ ] **Step 9: Replace `handleLoadSession` to load messages from Firestore on demand**

Find:
```typescript
  const handleLoadSession = useCallback((session: ChatSession) => {
    setMessages(session.messages);
    saveMessages(session.messages);
    setShowPanel(false);
  }, [setMessages]);
```

Replace with:
```typescript
  const handleLoadSession = useCallback(async (session: ChatSession) => {
    if (!user) return;
    let msgs = session.messages;
    if (msgs.length === 0) {
      msgs = await fsLoadMessages(user.uid, session.id);
    }
    setMessages(msgs);
    if (msgs.length > 0) fsSaveActiveChat(user.uid, msgs).catch(console.error);
    setShowPanel(false);
  }, [setMessages, user]);
```

Note: `handleLoadSession` now returns a Promise, so the `onClick` in `side-panel.tsx` will need to handle that — it's already fire-and-forget via an async callback, so no change needed there.

- [ ] **Step 10: Replace `handleDeleteSession` to delete from Firestore**

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

- [ ] **Step 11: Remove the history-load `useEffect`**

Find and delete:
```typescript
  useEffect(() => {
    setHistory(loadHistory());
  }, []);
```

History is now loaded in the Firestore restore effect.

- [ ] **Step 12: Update currency persistence to localStorage**

In the `SidePanel` `onChangeCurrency` prop handler, currently:
```typescript
        onChangeCurrency={(c) => { setCurrency(c); currencyRef.current = c; }}
```

Replace with:
```typescript
        onChangeCurrency={(c) => { setCurrency(c); currencyRef.current = c; localStorage.setItem("trippilot-currency", c); }}
```

- [ ] **Step 13: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace localStorage with Firestore sync for chat and profile"
```

---

## Chunk 3: Build + deploy

### Task 4: Build check + enable Firestore on Azure + deploy

**Files:**
- No code changes

- [ ] **Step 1: TypeScript build check**

```bash
cd /Users/developer/flightsmanager && npm run build 2>&1 | tail -30
```

Expected: clean build, no TypeScript errors.

If there are errors about `loadProfile` / `saveProfile` still being imported from `@/lib/travel-profile` elsewhere, find those imports and remove them. The `travel-profile.ts` functions can remain in the file (they're harmless) but `page.tsx` should no longer call them.

- [ ] **Step 2: Deploy**

```bash
git remote set-url origin https://REDACTED_PAT@github.com/Mubz0/flightsmanager.git
git push origin main
git remote set-url origin https://github.com/Mubz0/flightsmanager.git
```

Expected: GitHub Actions build + deploy succeeds.

- [ ] **Step 3: Smoke test**

Open `https://app-flightsmanager.azurewebsites.net/` in a browser, sign in, send a message, open a new browser profile, sign in with the same account, verify the chat history and profile appear.
