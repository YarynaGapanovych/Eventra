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

export const googleCalendarDefaultState: GoogleCalendarSyncState = {
  connected: false,
  connectedAt: null,
  lastSyncedAt: null,
  syncDaysBack: DEFAULT_SYNC_DAYS_BACK,
  syncDaysForward: DEFAULT_SYNC_DAYS_FORWARD,
};

function coercePreset(
  value: unknown,
  presets: readonly number[],
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  return presets.includes(n) ? n : fallback;
}

export function normalizeGoogleCalendarStatus(
  data: Partial<GoogleCalendarSyncState>,
): GoogleCalendarSyncState {
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
