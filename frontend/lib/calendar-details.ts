export type EventVisibility = "default" | "public" | "private";
export type GuestResponse =
  | "needsAction"
  | "accepted"
  | "declined"
  | "tentative";

export type CalendarGuest = {
  id: string;
  email: string;
  name: string | null;
  response: GuestResponse;
};

export type CalendarReminder = {
  id: string;
  minutesBefore: number;
};

export type CalendarGuestInput = {
  email: string;
  name?: string;
};

export type CalendarReminderInput = {
  minutesBefore: number;
};

export type CalendarDetails = {
  location: string | null;
  description: string | null;
  allDay: boolean;
  timezone: string | null;
  recurrence: string | null;
  busy: boolean;
  visibility: EventVisibility;
  conferenceUrl: string | null;
  guestCanModify: boolean;
  guestCanInvite: boolean;
  guestCanSeeOthers: boolean;
  guests: CalendarGuest[];
  reminders: CalendarReminder[];
};

export type CalendarDetailsInput = {
  location?: string | null;
  description?: string | null;
  allDay?: boolean;
  timezone?: string | null;
  recurrence?: string | null;
  busy?: boolean;
  visibility?: EventVisibility;
  conferenceUrl?: string | null;
  color?: string | null;
  guestCanModify?: boolean;
  guestCanInvite?: boolean;
  guestCanSeeOthers?: boolean;
  guests?: CalendarGuestInput[];
  reminders?: CalendarReminderInput[];
};

export const EMPTY_CALENDAR_DETAILS: CalendarDetails = {
  location: null,
  description: null,
  allDay: false,
  timezone: null,
  recurrence: null,
  busy: true,
  visibility: "default",
  conferenceUrl: null,
  guestCanModify: false,
  guestCanInvite: true,
  guestCanSeeOthers: true,
  guests: [],
  reminders: [],
};

export function withCalendarDefaults(
  value?: Partial<CalendarDetails> | null,
): CalendarDetails {
  return {
    ...EMPTY_CALENDAR_DETAILS,
    ...value,
    guests: value?.guests ?? [],
    reminders: value?.reminders ?? [],
  };
}

export const REMINDER_PRESETS = [
  { minutes: 0, label: "At time of event" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 10080, label: "1 week before" },
] as const;

export const VISIBILITY_OPTIONS: { value: EventVisibility; label: string }[] = [
  { value: "default", label: "Default visibility" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

const WEEKDAY_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const WEEKDAY_LABEL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayRrule(date: Date): string {
  return WEEKDAY_RRULE[date.getDay()] ?? "MO";
}

export function recurrenceOptions(start: Date): { value: string; label: string }[] {
  const day = WEEKDAY_LABEL[start.getDay()] ?? "Monday";
  const byday = weekdayRrule(start);
  return [
    { value: "", label: "Does not repeat" },
    { value: "FREQ=DAILY", label: "Daily" },
    { value: `FREQ=WEEKLY;BYDAY=${byday}`, label: `Weekly on ${day}` },
    { value: "FREQ=MONTHLY", label: "Monthly" },
    {
      value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      label: "Every weekday (Monday to Friday)",
    },
  ];
}

export function recurrenceSelectValue(
  recurrence: string | null | undefined,
  start: Date,
): string {
  const value = (recurrence ?? "").replace(/^RRULE:/i, "").trim();
  if (!value) return "";
  const options = recurrenceOptions(start);
  if (options.some((option) => option.value === value)) return value;
  return value;
}

export const RECURRENCE_INSTANCE_SEP = "::";

export function parseMasterEventId(id: string): string {
  const index = id.indexOf(RECURRENCE_INSTANCE_SEP);
  return index === -1 ? id : id.slice(0, index);
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedWallTimeToIso(
  date: string,
  time: string,
  timeZone: string,
): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = tzOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset).toISOString();
}

export function isoToZonedParts(
  iso: string,
  timeZone: string,
): { date: string; time: string } {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function listTimeZones(preferred?: string | null): string[] {
  let zones: string[] = [];
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      zones = Intl.supportedValuesOf("timeZone");
    }
  } catch {
    zones = [];
  }
  if (zones.length === 0) {
    zones = [
      "UTC",
      "Europe/Warsaw",
      "Europe/London",
      "America/New_York",
      "America/Los_Angeles",
      "Asia/Tokyo",
    ];
  }
  if (preferred && !zones.includes(preferred)) {
    return [preferred, ...zones];
  }
  return zones;
}

export function formatTimeZoneLabel(timeZone: string, at = new Date()): string {
  try {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(at)
        .find((part) => part.type === "timeZoneName")?.value ?? "";
    return offset ? `${timeZone} (${offset})` : timeZone;
  } catch {
    return timeZone;
  }
}
