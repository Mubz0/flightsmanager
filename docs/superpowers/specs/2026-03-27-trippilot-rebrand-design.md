# TripPilot Rebrand Design

**Date:** 2026-03-27
**Status:** Approved

## Summary

Rebrand the app from "FlightsManager" to "TripPilot" to reflect that it now covers both flights and hotels. The name change is purely cosmetic — no functional code changes.

**New name:** TripPilot
**Tagline:** "Your AI travel agent"

## Scope

### Files to update

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Title, description, keywords, siteName, authors, appleWebApp.title |
| `src/app/shared/layout.tsx` | Title, siteName, OG/Twitter tags |
| `src/app/shared/opengraph-image.tsx` | Display name and alt text |
| `src/app/page.tsx` | UI display text + localStorage keys |
| `src/app/shared/page.tsx` | UI display text |
| `src/lib/travel-profile.ts` | `PROFILE_STORAGE_KEY` constant |
| `package.json` | `name` field |
| `public/manifest.json` | App name and short name |

### Metadata changes

- **Title:** `TripPilot — Your AI travel agent`
- **Description:** `Plan flights and hotels with a conversational AI travel agent. Compare prices, explore destinations, and get personalised recommendations.`
- **Keywords:** add `hotels`, `accommodation`, `hotel search`
- **siteName / authors / appleWebApp.title:** `TripPilot`

### localStorage key renames

| Old key | New key |
|---------|---------|
| `flightsmanager-chat` | `trippilot-chat` |
| `flightsmanager-profile` | `trippilot-profile` |
| `flightsmanager-history` | `trippilot-history` |
| `flightsmanager-dark` | `trippilot-dark` |

> Note: Renaming localStorage keys will clear existing user sessions on next load. Acceptable for this stage.

## Out of scope

- Repo/folder rename (`flightsmanager/`) — not worth git disruption
- Azure deployment URL — infrastructure decision, handled separately
- All functional code — purely a branding pass
