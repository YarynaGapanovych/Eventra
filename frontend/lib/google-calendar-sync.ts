import { API_BASE } from "@/lib/tasks-api";

export const GOOGLE_CALENDAR_STORAGE_KEY = "eventra.google-calendar.v1";
export const GOOGLE_CALENDAR_SYNC_CHANGED_EVENT =
  "eventra-google-calendar-changed";

export type GoogleCalendarSyncState = {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
};

const DEFAULT_STATE: GoogleCalendarSyncState = {
  connected: false,
  connectedAt: null,
  lastSyncedAt: null,
};

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT));
}

export function loadGoogleCalendarSyncState(): GoogleCalendarSyncState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(GOOGLE_CALENDAR_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<GoogleCalendarSyncState>;
    return {
      connected: parsed.connected === true,
      connectedAt:
        typeof parsed.connectedAt === "string" ? parsed.connectedAt : null,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveGoogleCalendarSyncState(
  state: GoogleCalendarSyncState,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GOOGLE_CALENDAR_STORAGE_KEY,
    JSON.stringify(state),
  );
  notifyChanged();
}

export function markGoogleCalendarConnected(): GoogleCalendarSyncState {
  const now = new Date().toISOString();
  const state: GoogleCalendarSyncState = {
    connected: true,
    connectedAt: now,
    lastSyncedAt: null,
  };
  saveGoogleCalendarSyncState(state);
  return state;
}

export function disconnectGoogleCalendar(): void {
  saveGoogleCalendarSyncState(DEFAULT_STATE);
}

export function getGoogleCalendarConnectUrl(): string {
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/settings?google_calendar=callback`
      : "/settings?google_calendar=callback";
  const url = new URL(`${API_BASE}/integrations/google-calendar/connect`);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export function startGoogleCalendarConnect(): void {
  window.location.href = getGoogleCalendarConnectUrl();
}

export async function syncGoogleCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/integrations/google-calendar/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Could not sync Google Calendar.";
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string") msg = j.message;
    } catch {
      if (text.trim()) msg = text.slice(0, 400);
    }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as { syncedAt?: string };
  const syncedAt =
    typeof data.syncedAt === "string"
      ? data.syncedAt
      : new Date().toISOString();
  const current = loadGoogleCalendarSyncState();
  saveGoogleCalendarSyncState({
    ...current,
    connected: true,
    lastSyncedAt: syncedAt,
  });
  return syncedAt;
}
