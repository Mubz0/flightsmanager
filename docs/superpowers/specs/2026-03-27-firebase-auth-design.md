# Firebase Auth Design — TripPilot

**Date:** 2026-03-27
**Status:** Approved

## Summary

Gate the entire TripPilot app behind Firebase Authentication. Unauthenticated users see only a login/signup screen. Authenticated users get the full app experience.

**Providers:** Google, Email/Password (Facebook deferred — needs Meta App ID/secret)
**Firebase project:** `trippilot-9a610`

## Architecture

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/firebase.ts` | Initialise Firebase app from `NEXT_PUBLIC_FIREBASE_*` env vars |
| `src/lib/auth.ts` | Thin wrappers: `signInWithGoogle()`, `signInWithEmail()`, `signUpWithEmail()`, `signOut()` |
| `src/contexts/auth-context.tsx` | React context exposing `user: User \| null` and `loading: boolean` via `onAuthStateChanged` |
| `src/components/auth-screen.tsx` | Full-page login/signup UI — Google button + email/password form, toggle between sign in / sign up |

### Modified files

| File | Change |
|------|--------|
| `src/components/client-providers.tsx` | Wrap children with `AuthProvider` |
| `src/app/page.tsx` | If `loading` → spinner; if no `user` → `<AuthScreen />`; else → full app. Header gets user avatar + sign-out button |

## Auth Flow

1. App loads → `AuthProvider` subscribes to `onAuthStateChanged`
2. State: `loading=true` → show full-page spinner
3. State: `user=null` → show `<AuthScreen />`
4. User signs in (Google popup or email/password form) → `user` populated → app renders
5. Header shows user avatar/display name + sign-out button
6. Sign out → `user=null` → back to `<AuthScreen />`

## Environment Variables (already in .env.local)

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

## Out of scope

- Facebook auth (deferred — needs Meta App credentials)
- Role-based access control (all authenticated users have equal access)
- Server-side auth verification (API routes remain unchanged)
- User profile storage in Firestore
