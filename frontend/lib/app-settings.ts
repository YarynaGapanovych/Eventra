const STORAGE_KEY = "eventra.settings.v1";

export type AppSettings = {
  /** Local wall-clock HH:mm */
  workdayStart: string;
  workdayEnd: string;
  /** IANA time zone ID */
  timezone: string;
  defaultEventDurationMinutes: number;
  showPastDoneTaskEvents: boolean;
};

export const DEFAULT_APP_SETTINGS: Omit<AppSettings, "timezone"> = {
  workdayStart: "09:00",
  workdayEnd: "17:00",
  defaultEventDurationMinutes: 60,
  showPastDoneTaskEvents: true,
};

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120] as const;

export function durationChoices(): readonly number[] {
  return DURATION_CHOICES;
}

export function getDefaultTimezone(): string {
  if (typeof Intl === "undefined") return "UTC";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function coerceTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return fallback;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function coerceTimezone(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function coerceDuration(value: unknown, fallback: number): number {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 5 || n > 24 * 60) return fallback;
  return n;
}

export function listTimezones(): string[] {
  try {
    const fn = (
      Intl as unknown as {
        supportedValuesOf?: (k: string) => string[];
      }
    ).supportedValuesOf;
    if (typeof fn === "function") {
      const z = fn.call(Intl, "timeZone");
      if (Array.isArray(z) && z.length > 0) return [...z].sort();
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_TIMEZONES;
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Warsaw",
  "Europe/Kyiv",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
];

export function normalizeSettingsPartial(raw: unknown): AppSettings {
  const tz = getDefaultTimezone();
  const base: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    timezone: tz,
  };
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  return {
    workdayStart: coerceTime(o.workdayStart, DEFAULT_APP_SETTINGS.workdayStart),
    workdayEnd: coerceTime(o.workdayEnd, DEFAULT_APP_SETTINGS.workdayEnd),
    timezone: coerceTimezone(o.timezone) ?? tz,
    defaultEventDurationMinutes: coerceDuration(
      o.defaultEventDurationMinutes,
      DEFAULT_APP_SETTINGS.defaultEventDurationMinutes,
    ),
    showPastDoneTaskEvents:
      typeof o.showPastDoneTaskEvents === "boolean"
        ? o.showPastDoneTaskEvents
        : DEFAULT_APP_SETTINGS.showPastDoneTaskEvents,
  };
}

/** Safe on server — returns defaults (UTC) without reading storage. */
export function getAppSettingsPlaceholder(): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    timezone: "UTC",
  };
}

export function takeLegacyLocalSettings(): AppSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSettingsPartial(parsed);
  } catch {
    return null;
  }
}

export function clearLegacyLocalSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
