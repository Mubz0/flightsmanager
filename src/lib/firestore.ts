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
    const BATCH_LIMIT = 490;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const content =
        msg.parts?.find((p) => p.type === "text")?.text ??
        (typeof (msg as any).content === "string" ? (msg as any).content : "");
      batch.set(
        doc(db, "users", uid, "sessions", meta.id, "messages", msg.id),
        { id: msg.id, role: msg.role, content, createdAt: meta.createdAt + i } satisfies StoredMessage
      );
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

export async function migrateFromLocalStorage(uid: string): Promise<void> {
  try {
    const fsProfile = await fsLoadProfile(uid);
    if (Object.keys(fsProfile).length > 0) return;

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

    localStorage.removeItem("trippilot-profile");
    localStorage.removeItem("trippilot-history");
    localStorage.removeItem("trippilot-chat");

    console.log("[TripPilot] Migrated localStorage data to Firestore");
  } catch (e) {
    console.error("[TripPilot] migrateFromLocalStorage", e);
  }
}
