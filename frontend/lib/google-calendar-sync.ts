export const DEFAULT_SYNC_DAYS_BACK = 30;
export const DEFAULT_SYNC_DAYS_FORWARD = 90;

export const SYNC_DAYS_BACK_PRESETS = [7, 14, 30, 90, 180, 365] as const;
export const SYNC_DAYS_FORWARD_PRESETS = [30, 90, 180, 365] as const;

export type GoogleCalendarOverlapNotice = {
  id: string;
  title: string;
  overlappingTitles: string[];
  start: string;
  end: string;
};

export type GoogleCalendarSyncState = {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  syncDaysBack: number;
  syncDaysForward: number;
  pendingOverlaps: GoogleCalendarOverlapNotice[];
};

export const googleCalendarDefaultState: GoogleCalendarSyncState = {
  connected: false,
  connectedAt: null,
  lastSyncedAt: null,
  syncDaysBack: DEFAULT_SYNC_DAYS_BACK,
  syncDaysForward: DEFAULT_SYNC_DAYS_FORWARD,
  pendingOverlaps: [],
};

function coercePreset(
  value: unknown,
  presets: readonly number[],
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  return presets.includes(n) ? n : fallback;
}

function parseOverlapNotices(value: unknown): GoogleCalendarOverlapNotice[] {
  if (!Array.isArray(value)) return [];
  const notices: GoogleCalendarOverlapNotice[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string") continue;
    if (typeof row.start !== "string" || typeof row.end !== "string") continue;
    const overlappingTitles = Array.isArray(row.overlappingTitles)
      ? row.overlappingTitles.filter(
          (title): title is string => typeof title === "string",
        )
      : [];
    notices.push({
      id: row.id,
      title: row.title,
      overlappingTitles,
      start: row.start,
      end: row.end,
    });
  }
  return notices;
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
    pendingOverlaps: parseOverlapNotices(data.pendingOverlaps),
  };
}
