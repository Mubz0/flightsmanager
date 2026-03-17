export interface TravelProfile {
  preferredAirlines?: string[];
  excludedAirlines?: string[];
  loyaltyPrograms?: string[];
  maxBudget?: number;
  cabinClass?: string;
  maxStops?: number;
  maxLayoverHours?: number;
  timePreference?: "morning" | "afternoon" | "evening" | "red-eye" | null;
  homeAirport?: string;
  notes?: string[];
}

export const PROFILE_STORAGE_KEY = "flightsmanager-profile";

export function loadProfile(): TravelProfile {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveProfile(profile: TravelProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch { /* quota exceeded */ }
}

export function mergeProfile(existing: TravelProfile, updates: Partial<TravelProfile>): TravelProfile {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (merged as any)[key] = value;
  }
  return merged;
}

export function profileToPrompt(profile: TravelProfile): string {
  const parts: string[] = [];
  if (profile.homeAirport) parts.push(`Home airport: ${profile.homeAirport}`);
  if (profile.preferredAirlines?.length) parts.push(`Preferred airlines: ${profile.preferredAirlines.join(", ")}`);
  if (profile.excludedAirlines?.length) parts.push(`Excluded airlines: ${profile.excludedAirlines.join(", ")}`);
  if (profile.loyaltyPrograms?.length) parts.push(`Loyalty programs: ${profile.loyaltyPrograms.join(", ")}`);
  if (profile.maxBudget) parts.push(`Default budget: $${profile.maxBudget}`);
  if (profile.cabinClass) parts.push(`Preferred cabin: ${profile.cabinClass}`);
  if (profile.maxStops !== undefined) parts.push(`Max stops: ${profile.maxStops}`);
  if (profile.maxLayoverHours) parts.push(`Max layover: ${profile.maxLayoverHours}h`);
  if (profile.timePreference) parts.push(`Time preference: ${profile.timePreference}`);
  if (profile.notes?.length) parts.push(`Notes: ${profile.notes.join("; ")}`);
  if (parts.length === 0) return "";
  return `\n\n## User Travel Profile (apply implicitly unless overridden)\n${parts.join("\n")}`;
}
