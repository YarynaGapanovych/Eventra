import {
  isoToZonedParts,
  zonedWallTimeToIso,
} from "@/lib/calendar-details";
import { rangesOverlap } from "@/lib/event-overlap";

export const ANALYTICS_RANGES = [
  "This week",
  "Last 7 days",
  "This month",
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type DayHours = {
  day: string;
  booked: number;
  free: number;
  capacity: number;
};

export type LoadEvent = {
  id?: string;
  start: string;
  end: string;
  title?: string;
  taskId?: string | null;
  busy?: boolean;
  allDay?: boolean;
};

export type LoadSettings = {
  workdayStart: string;
  workdayEnd: string;
  timezone: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const HEATMAP_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export type FrequentEvent = {
  title: string;
  count: number;
  hours: number;
};

export type PeakHours = {
  weekdays: typeof HEATMAP_WEEKDAYS;
  hours: number[];
  minutes: number[][];
  busiest: { day: string; slot: string } | null;
};

export type AttentionItem = {
  kind: "overlap" | "overload";
  title: string;
  detail: string;
};

export type TaskBlocks = {
  tasksByDay: { day: string; tasks: number }[];
  avgTasksPerWorkday: number;
};

type Interval = { start: number; end: number };

function minutesFromHm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function workdayHours(settings: LoadSettings): number {
  const start = minutesFromHm(settings.workdayStart);
  const end = minutesFromHm(settings.workdayEnd);
  if (end <= start) return 0;
  return (end - start) / 60;
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

function utcWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function isWeekend(date: string): boolean {
  const day = utcWeekday(date);
  return day === 0 || day === 6;
}

function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[utcWeekday(date)] ?? date;
}

function addDays(date: string, delta: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

function startOfIsoWeek(date: string): string {
  const fromMonday = (utcWeekday(date) + 6) % 7;
  return addDays(date, -fromMonday);
}

function lastDateOfMonth(yearMonthStart: string): string {
  const [year, month] = yearMonthStart.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

function eachDate(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function zonedToday(now: Date, timeZone: string): string {
  return isoToZonedParts(now.toISOString(), timeZone).date;
}

function rangeDates(
  range: AnalyticsRange,
  today: string,
): { dates: string[]; weekly: boolean } {
  if (range === "This week") {
    const monday = startOfIsoWeek(today);
    return { dates: eachDate(monday, addDays(monday, 6)), weekly: false };
  }
  if (range === "Last 7 days") {
    return { dates: eachDate(addDays(today, -6), today), weekly: false };
  }
  const first = `${today.slice(0, 7)}-01`;
  return { dates: eachDate(first, lastDateOfMonth(first)), weekly: true };
}

function dayCapacityHours(date: string, weekdayHours: number): number {
  return isWeekend(date) ? 0 : weekdayHours;
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    const current = merged[merged.length - 1];
    if (!current) {
      merged.push({ start: next.start, end: next.end });
      continue;
    }
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
      continue;
    }
    merged.push({ start: next.start, end: next.end });
  }
  return merged;
}

function mergeDurationMs(intervals: Interval[]): number {
  return mergeIntervals(intervals).reduce(
    (total, interval) => total + (interval.end - interval.start),
    0,
  );
}

function coveredDates(
  startIso: string,
  endIso: string,
  timeZone: string,
): string[] {
  const start = isoToZonedParts(startIso, timeZone);
  const end = isoToZonedParts(endIso, timeZone);
  let last = end.date;
  if (end.time === "00:00" && end.date > start.date) {
    last = addDays(end.date, -1);
  }
  return eachDate(start.date, last);
}

function pushInterval(
  byDate: Map<string, Interval[]>,
  date: string,
  start: number,
  end: number,
) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  const list = byDate.get(date);
  if (list) list.push({ start, end });
  else byDate.set(date, [{ start, end }]);
}

function collectIntervals(
  events: LoadEvent[],
  settings: LoadSettings,
  dates: ReadonlySet<string>,
): Map<string, Interval[]> {
  const byDate = new Map<string, Interval[]>();
  const weekdayHours = workdayHours(settings);
  const { timezone, workdayStart, workdayEnd } = settings;

  for (const event of events) {
    if (event.busy === false) continue;
    const startMs = toMs(event.start);
    const endMs = toMs(event.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      continue;
    }

    if (event.allDay) {
      for (const date of coveredDates(event.start, event.end, timezone)) {
        if (!dates.has(date) || isWeekend(date) || weekdayHours <= 0) continue;
        const start = toMs(zonedWallTimeToIso(date, workdayStart, timezone));
        const end = toMs(zonedWallTimeToIso(date, workdayEnd, timezone));
        pushInterval(byDate, date, start, end);
      }
      continue;
    }

    for (const date of coveredDates(event.start, event.end, timezone)) {
      if (!dates.has(date)) continue;
      const dayStart = toMs(zonedWallTimeToIso(date, "00:00", timezone));
      const dayEnd = toMs(zonedWallTimeToIso(addDays(date, 1), "00:00", timezone));
      pushInterval(
        byDate,
        date,
        Math.max(startMs, dayStart),
        Math.min(endMs, dayEnd),
      );
    }
  }

  return byDate;
}

function hoursForDate(
  date: string,
  intervals: Map<string, Interval[]>,
  weekdayHours: number,
): DayHours {
  const bookedMs = mergeDurationMs(intervals.get(date) ?? []);
  const booked = roundHours(bookedMs / 3_600_000);
  const capacity = dayCapacityHours(date, weekdayHours);
  return {
    day: weekdayLabel(date),
    booked,
    capacity,
    free: Math.max(0, roundHours(capacity - booked)),
  };
}

function aggregateWeeks(
  dates: string[],
  intervals: Map<string, Interval[]>,
  weekdayHours: number,
): DayHours[] {
  const groups = new Map<string, string[]>();
  for (const date of dates) {
    const monday = startOfIsoWeek(date);
    const existing = groups.get(monday);
    if (existing) existing.push(date);
    else groups.set(monday, [date]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, weekDates], index) => {
      let booked = 0;
      let capacity = 0;
      for (const date of weekDates) {
        const day = hoursForDate(date, intervals, weekdayHours);
        booked += day.booked;
        capacity += day.capacity;
      }
      booked = roundHours(booked);
      capacity = roundHours(capacity);
      return {
        day: `Week ${index + 1}`,
        booked,
        capacity,
        free: Math.max(0, roundHours(capacity - booked)),
      };
    });
}

export function computeDailyLoad(
  events: LoadEvent[],
  settings: LoadSettings,
  range: AnalyticsRange,
  now: Date = new Date(),
): DayHours[] {
  const today = zonedToday(now, settings.timezone);
  const { dates, weekly } = rangeDates(range, today);
  const dateSet = new Set(dates);
  const weekdayHours = workdayHours(settings);
  const intervals = collectIntervals(events, settings, dateSet);

  if (weekly) {
    return aggregateWeeks(dates, intervals, weekdayHours);
  }

  return dates.map((date) => hoursForDate(date, intervals, weekdayHours));
}

function padHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function workdayHourSlots(settings: LoadSettings): number[] {
  const startM = minutesFromHm(settings.workdayStart);
  const endM = minutesFromHm(settings.workdayEnd);
  if (endM <= startM) return [];
  const from = Math.floor(startM / 60);
  const to = Math.ceil(endM / 60);
  const hours: number[] = [];
  for (let hour = from; hour < to && hour < 24; hour += 1) {
    hours.push(hour);
  }
  return hours;
}

function hourSlotBounds(
  date: string,
  hour: number,
  settings: LoadSettings,
): Interval {
  const { timezone, workdayStart, workdayEnd } = settings;
  const slotStart = toMs(
    zonedWallTimeToIso(date, `${String(hour).padStart(2, "0")}:00`, timezone),
  );
  const slotEnd =
    hour >= 23
      ? toMs(zonedWallTimeToIso(addDays(date, 1), "00:00", timezone))
      : toMs(
          zonedWallTimeToIso(
            date,
            `${String(hour + 1).padStart(2, "0")}:00`,
            timezone,
          ),
        );
  const workStart = toMs(zonedWallTimeToIso(date, workdayStart, timezone));
  const workEnd = toMs(zonedWallTimeToIso(date, workdayEnd, timezone));
  return {
    start: Math.max(slotStart, workStart),
    end: Math.min(slotEnd, workEnd),
  };
}

function overlapMinutes(
  intervals: Interval[],
  slot: Interval,
): number {
  if (slot.end <= slot.start) return 0;
  let ms = 0;
  for (const interval of intervals) {
    const start = Math.max(interval.start, slot.start);
    const end = Math.min(interval.end, slot.end);
    if (end > start) ms += end - start;
  }
  return Math.min(60, Math.round(ms / 60_000));
}

export function computePeakHours(
  events: LoadEvent[],
  settings: LoadSettings,
  range: AnalyticsRange,
  now: Date = new Date(),
): PeakHours {
  const today = zonedToday(now, settings.timezone);
  const { dates } = rangeDates(range, today);
  const hours = workdayHourSlots(settings);
  const datesByWeekday = new Map<string, string[]>();
  for (const day of HEATMAP_WEEKDAYS) datesByWeekday.set(day, []);
  for (const date of dates) {
    const label = weekdayLabel(date);
    const bucket = datesByWeekday.get(label);
    if (bucket) bucket.push(date);
  }

  const weekdayDates = dates.filter((date) => !isWeekend(date));
  const intervals = collectIntervals(events, settings, new Set(weekdayDates));

  const minutes = HEATMAP_WEEKDAYS.map((day) => {
    const dayDates = datesByWeekday.get(day) ?? [];
    return hours.map((hour) => {
      if (dayDates.length === 0) return 0;
      let total = 0;
      for (const date of dayDates) {
        const merged = mergeIntervals(intervals.get(date) ?? []);
        total += overlapMinutes(merged, hourSlotBounds(date, hour, settings));
      }
      return Math.round(total / dayDates.length);
    });
  });

  let busiest: PeakHours["busiest"] = null;
  let max = 0;
  for (let dayIndex = 0; dayIndex < HEATMAP_WEEKDAYS.length; dayIndex += 1) {
    for (let hourIndex = 0; hourIndex < hours.length; hourIndex += 1) {
      const value = minutes[dayIndex]?.[hourIndex] ?? 0;
      if (value <= max) continue;
      max = value;
      const hour = hours[hourIndex];
      busiest = {
        day: HEATMAP_WEEKDAYS[dayIndex],
        slot: `${padHour(hour)}–${padHour(hour + 1)}`,
      };
    }
  }

  return { weekdays: HEATMAP_WEEKDAYS, hours, minutes, busiest };
}

function eventHoursInRange(
  event: LoadEvent,
  settings: LoadSettings,
  dateSet: ReadonlySet<string>,
): number {
  const weekdayHours = workdayHours(settings);
  if (event.allDay) {
    let hours = 0;
    for (const date of coveredDates(event.start, event.end, settings.timezone)) {
      if (!dateSet.has(date)) continue;
      hours += dayCapacityHours(date, weekdayHours);
    }
    return hours;
  }

  const startMs = toMs(event.start);
  const endMs = toMs(event.end);
  let ms = 0;
  for (const date of coveredDates(event.start, event.end, settings.timezone)) {
    if (!dateSet.has(date)) continue;
    const dayStart = toMs(zonedWallTimeToIso(date, "00:00", settings.timezone));
    const dayEnd = toMs(
      zonedWallTimeToIso(addDays(date, 1), "00:00", settings.timezone),
    );
    const start = Math.max(startMs, dayStart);
    const end = Math.min(endMs, dayEnd);
    if (end > start) ms += end - start;
  }
  return ms / 3_600_000;
}

export function computeFrequentEvents(
  events: LoadEvent[],
  settings: LoadSettings,
  range: AnalyticsRange,
  limit = 5,
  now: Date = new Date(),
): FrequentEvent[] {
  const today = zonedToday(now, settings.timezone);
  const dateSet = new Set(rangeDates(range, today).dates);
  const grouped = new Map<string, FrequentEvent>();

  for (const event of events) {
    if (event.busy === false) continue;
    const title = event.title?.trim() ?? "";
    if (!title) continue;
    const hours = eventHoursInRange(event, settings, dateSet);
    if (hours <= 0) continue;

    const key = title.toLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.hours = roundHours(existing.hours + hours);
      continue;
    }
    grouped.set(key, { title, count: 1, hours: roundHours(hours) });
  }

  return [...grouped.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || b.hours - a.hours)
    .slice(0, limit);
}

const WEEKDAY_FULL: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

function eventTouchesRange(
  event: LoadEvent,
  dateSet: ReadonlySet<string>,
  timeZone: string,
): boolean {
  return coveredDates(event.start, event.end, timeZone).some((date) =>
    dateSet.has(date),
  );
}

function eventTitle(event: LoadEvent): string {
  return event.title?.trim() || "Untitled event";
}

function formatClock(time: string): string {
  return time;
}

function formatOverlapDetail(
  a: LoadEvent,
  b: LoadEvent,
  timeZone: string,
): string {
  const aParts = isoToZonedParts(a.start, timeZone);
  const aEnd = isoToZonedParts(a.end, timeZone);
  const bParts = isoToZonedParts(b.start, timeZone);
  const bEnd = isoToZonedParts(b.end, timeZone);
  const left = `${weekdayLabel(aParts.date)} ${formatClock(aParts.time)}–${formatClock(aEnd.time)}`;
  const rightTime = `${formatClock(bParts.time)}–${formatClock(bEnd.time)}`;
  const right =
    aParts.date === bParts.date
      ? `${eventTitle(b)} ${rightTime}`
      : `${eventTitle(b)} ${weekdayLabel(bParts.date)} ${rightTime}`;
  return `${left} and ${right}.`;
}

export function computeAttention(
  events: LoadEvent[],
  settings: LoadSettings,
  range: AnalyticsRange,
  limit = 6,
  now: Date = new Date(),
): AttentionItem[] {
  const today = zonedToday(now, settings.timezone);
  const dateSet = new Set(rangeDates(range, today).dates);
  const inRange = events.filter((event) => {
    if (event.busy === false) return false;
    const startMs = toMs(event.start);
    const endMs = toMs(event.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return false;
    }
    return eventTouchesRange(event, dateSet, settings.timezone);
  });

  const overlaps: AttentionItem[] = [];
  for (let i = 0; i < inRange.length; i += 1) {
    const a = inRange[i];
    for (let j = i + 1; j < inRange.length; j += 1) {
      const b = inRange[j];
      if (!rangesOverlap(a, b)) continue;
      const first = toMs(a.start) <= toMs(b.start) ? a : b;
      const second = first === a ? b : a;
      overlaps.push({
        kind: "overlap",
        title: `${eventTitle(first)} overlaps ${eventTitle(second)}`,
        detail: formatOverlapDetail(first, second, settings.timezone),
      });
    }
  }

  const overloads: AttentionItem[] = computeDailyLoad(
    events,
    settings,
    range,
    now,
  )
    .filter((day) => day.booked > day.capacity && day.capacity > 0)
    .map((day) => {
      const isWeek = day.day.startsWith("Week");
      const label = isWeek ? day.day : (WEEKDAY_FULL[day.day] ?? day.day);
      return {
        kind: "overload" as const,
        title: `${label} is overloaded`,
        detail: isWeek
          ? `${day.booked}h booked against ${day.capacity}h workday capacity.`
          : `${day.booked}h booked against an ${day.capacity}h workday.`,
      };
    });

  return [...overlaps, ...overloads].slice(0, limit);
}

export function computeTaskBlocksByDay(
  events: LoadEvent[],
  settings: LoadSettings,
  range: AnalyticsRange,
  now: Date = new Date(),
): TaskBlocks {
  const today = zonedToday(now, settings.timezone);
  const { dates, weekly } = rangeDates(range, today);
  const dateSet = new Set(dates);
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, 0);

  for (const event of events) {
    if (!event.taskId) continue;
    for (const date of coveredDates(event.start, event.end, settings.timezone)) {
      if (!dateSet.has(date)) continue;
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  let weekdayBlocks = 0;
  let weekdayCount = 0;
  for (const date of dates) {
    if (isWeekend(date)) continue;
    weekdayCount += 1;
    weekdayBlocks += counts.get(date) ?? 0;
  }

  const tasksByDay = HEATMAP_WEEKDAYS.map((day) => {
    const dayDates = dates.filter((date) => weekdayLabel(date) === day);
    if (dayDates.length === 0) return { day, tasks: 0 };
    const total = dayDates.reduce((sum, date) => sum + (counts.get(date) ?? 0), 0);
    const tasks = weekly ? roundHours(total / dayDates.length) : total;
    return { day, tasks };
  });

  return {
    tasksByDay,
    avgTasksPerWorkday:
      weekdayCount === 0 ? 0 : roundHours(weekdayBlocks / weekdayCount),
  };
}
