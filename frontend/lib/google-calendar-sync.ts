import { API_BASE } from "@/lib/tasks-api";

export const GOOGLE_CALENDAR_SYNC_CHANGED_EVENT =
  "eventra-google-calendar-changed";

export const DEFAULT_SYNC_DAYS_BACK = 30;
export const DEFAULT_SYNC_DAYS_FORWARD = 90;

export const SYNC_DAYS_BACK_PRESETS = [7, 14, 30, 90, 180, 365] as const;
export const SYNC_DAYS_FORWARD_PRESETS = [30, 90, 180, 365] as const;

export type GoogleCalendarSyncState = {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  syncDaysBack: number;
  syncDaysForward: number;
};

const DEFAULT_STATE: GoogleCalendarSyncState = {
  connected: false,
  connectedAt: null,
  lastSyncedAt: null,
  syncDaysBack: DEFAULT_SYNC_DAYS_BACK,
  syncDaysForward: DEFAULT_SYNC_DAYS_FORWARD,
};

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT));
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function coercePreset(
  value: unknown,
  presets: readonly number[],
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  return presets.includes(n) ? n : fallback;
}

export async function fetchGoogleCalendarStatus(
  accessToken: string,
): Promise<GoogleCalendarSyncState> {
  const res = await fetch(`${API_BASE}/integrations/google-calendar/status`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new Error("Session expired — sign in to Eventra again.");
  }
  if (!res.ok) {
    throw new Error("Could not load Google Calendar status.");
  }
  const data = (await res.json()) as Partial<GoogleCalendarSyncState>;
  return {
    connected: data.connected === true,
    connectedAt:
      typeof data.connectedAt === "string" ? data.connectedAt : null,
    lastSyncedAt:
      typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : null,
    syncDaysBack: coercePreset(
      data.syncDaysBack,
      SYNC_DAYS_BACK_PRESETS,
      DEFAULT_SYNC_DAYS_BACK,
    ),
    syncDaysForward: coercePreset(
      data.syncDaysForward,
      SYNC_DAYS_FORWARD_PRESETS,
      DEFAULT_SYNC_DAYS_FORWARD,
    ),
  };
}

export async function startGoogleCalendarConnect(
  accessToken: string,
): Promise<void> {
  const redirectUri = `${window.location.origin}/settings?google_calendar=connected`;
  const res = await fetch(`${API_BASE}/integrations/google-calendar/start`, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ redirect_uri: redirectUri }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Could not start Google Calendar connect.";
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === "string") msg = j.message;
    } catch {
      if (text.trim()) msg = text.slice(0, 400);
    }
    throw new Error(msg);
  }
  const data = JSON.parse(text) as { connectUrl?: string };
  if (!data.connectUrl) {
    throw new Error("Connect URL missing from server response.");
  }
  window.location.href = data.connectUrl;
}

export async function disconnectGoogleCalendar(
  accessToken: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/integrations/google-calendar/disconnect`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
    },
  );
  if (!res.ok) {
    throw new Error("Could not disconnect Google Calendar.");
  }
  notifyChanged();
}

export async function syncGoogleCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/integrations/google-calendar/sync`, {
    method: "POST",
    headers: authHeaders(accessToken),
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
  notifyChanged();
  return syncedAt;
}

export async function updateGoogleCalendarSyncWindow(
  accessToken: string,
  window: { syncDaysBack: number; syncDaysForward: number },
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/integrations/google-calendar/sync-window`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(window),
    },
  );
  if (!res.ok) {
    throw new Error("Could not save the Google Calendar sync window.");
  }
}

export { DEFAULT_STATE as googleCalendarDefaultState };
