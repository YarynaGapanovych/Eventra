import { BadRequestException } from '@nestjs/common';
import {
  EventSource,
  EventVisibility,
  GuestResponse,
  type Event as PrismaEvent,
  type EventGuest,
  type EventReminder,
  type Task as PrismaTask,
  type TaskGuest,
  type TaskReminder,
} from '../generated/prisma/client';
import type { CalendarDetailsInput } from './calendar.types';
import type { CalendarGuest, CalendarReminder } from './calendar.types';
import type { Event } from '../events/event.types';
import {
  DEFAULT_SYNC_DAYS_BACK,
  DEFAULT_SYNC_DAYS_FORWARD,
} from '../integrations/google-calendar-sync-window';

export const EVENT_DETAIL_INCLUDE = {
  guests: true,
  reminders: true,
} as const;

export const TASK_DETAIL_INCLUDE = {
  guests: true,
  reminders: true,
  events: {
    include: EVENT_DETAIL_INCLUDE,
    orderBy: { start: 'asc' as const },
  },
};

export type EventWithDetails = PrismaEvent & {
  guests: EventGuest[];
  reminders: EventReminder[];
};

export type TaskWithDetails = PrismaTask & {
  guests: TaskGuest[];
  reminders: TaskReminder[];
  events: EventWithDetails[];
};

export const RECURRENCE_INSTANCE_SEP = '::';

export function parseMasterEventId(id: string): {
  masterId: string;
  instanceStart: Date | null;
} {
  const i = id.indexOf(RECURRENCE_INSTANCE_SEP);
  if (i === -1) return { masterId: id, instanceStart: null };
  const instanceStart = new Date(id.slice(i + RECURRENCE_INSTANCE_SEP.length));
  return {
    masterId: id.slice(0, i),
    instanceStart: Number.isNaN(instanceStart.getTime()) ? null : instanceStart,
  };
}

export function instanceEventId(masterId: string, start: Date): string {
  return `${masterId}${RECURRENCE_INSTANCE_SEP}${start.toISOString()}`;
}

export function emptyToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalizeHexColor(
  value?: string | null,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function parseIsoDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return parsed;
}

export function assertRange(start: Date, end: Date): void {
  if (end.getTime() < start.getTime()) {
    throw new BadRequestException('End must be after start.');
  }
}

export function parseRange(
  startValue: string,
  endValue: string,
): { start: Date; end: Date } {
  const start = parseIsoDate(startValue, 'start');
  const end = parseIsoDate(endValue, 'end');
  assertRange(start, end);
  return { start, end };
}

export function calendarScalarData(input: CalendarDetailsInput): {
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
} {
  const data: ReturnType<typeof calendarScalarData> = {};
  if (input.location !== undefined) data.location = emptyToNull(input.location);
  if (input.description !== undefined) {
    data.description = emptyToNull(input.description);
  }
  if (input.allDay !== undefined) data.allDay = input.allDay;
  if (input.timezone !== undefined) data.timezone = emptyToNull(input.timezone);
  if (input.recurrence !== undefined) {
    data.recurrence = emptyToNull(input.recurrence);
  }
  if (input.busy !== undefined) data.busy = input.busy;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.conferenceUrl !== undefined) {
    data.conferenceUrl = emptyToNull(input.conferenceUrl);
  }
  if (input.color !== undefined) data.color = normalizeHexColor(input.color);
  if (input.guestCanModify !== undefined) {
    data.guestCanModify = input.guestCanModify;
  }
  if (input.guestCanInvite !== undefined) {
    data.guestCanInvite = input.guestCanInvite;
  }
  if (input.guestCanSeeOthers !== undefined) {
    data.guestCanSeeOthers = input.guestCanSeeOthers;
  }
  return data;
}

export function guestCreateData(
  guests?: CalendarDetailsInput['guests'],
): { email: string; name: string | null }[] {
  if (!guests) return [];
  const seen = new Set<string>();
  const rows: { email: string; name: string | null }[] = [];
  for (const guest of guests) {
    const email = guest.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    rows.push({
      email,
      name: guest.name?.trim() ? guest.name.trim() : null,
    });
  }
  return rows;
}

export function reminderCreateData(
  reminders?: CalendarDetailsInput['reminders'],
): { minutesBefore: number }[] {
  if (!reminders) return [];
  const seen = new Set<number>();
  const rows: { minutesBefore: number }[] = [];
  for (const reminder of reminders) {
    const minutes = reminder.minutesBefore;
    if (!Number.isInteger(minutes) || minutes < 0 || seen.has(minutes)) {
      continue;
    }
    seen.add(minutes);
    rows.push({ minutesBefore: minutes });
  }
  return rows;
}

export function nestedGuestReminderCreate(input: CalendarDetailsInput): {
  guests?: { create: { email: string; name: string | null }[] };
  reminders?: { create: { minutesBefore: number }[] };
} {
  const guests = guestCreateData(input.guests);
  const reminders = reminderCreateData(input.reminders);
  return {
    ...(guests.length ? { guests: { create: guests } } : {}),
    ...(reminders.length ? { reminders: { create: reminders } } : {}),
  };
}

export function toGuestDtos(
  guests: { id: string; email: string; name: string | null; response: GuestResponse }[],
): CalendarGuest[] {
  return guests.map((guest) => ({
    id: guest.id,
    email: guest.email,
    name: guest.name,
    response: guest.response,
  }));
}

export function toReminderDtos(
  reminders: { id: string; minutesBefore: number }[],
): CalendarReminder[] {
  return reminders.map((reminder) => ({
    id: reminder.id,
    minutesBefore: reminder.minutesBefore,
  }));
}

export function toEventDto(event: EventWithDetails): Event {
  return {
    id: event.id,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    source: event.source,
    googleEventId: event.googleEventId,
    color: event.color,
    taskId: event.taskId,
    location: event.location,
    description: event.description,
    allDay: event.allDay,
    timezone: event.timezone,
    recurrence: event.recurrence,
    busy: event.busy,
    visibility: event.visibility,
    conferenceUrl: event.conferenceUrl,
    guestCanModify: event.guestCanModify,
    guestCanInvite: event.guestCanInvite,
    guestCanSeeOthers: event.guestCanSeeOthers,
    guests: toGuestDtos(event.guests),
    reminders: toReminderDtos(event.reminders),
  };
}

export function calendarDataFromTask(task: TaskWithDetails): {
  location: string | null;
  description: string | null;
  allDay: boolean;
  timezone: string | null;
  recurrence: string | null;
  busy: boolean;
  visibility: EventVisibility;
  conferenceUrl: string | null;
  color: string | null;
  guestCanModify: boolean;
  guestCanInvite: boolean;
  guestCanSeeOthers: boolean;
  guests: { create: { email: string; name: string | null; response: GuestResponse }[] };
  reminders: { create: { minutesBefore: number }[] };
} {
  return {
    location: task.location,
    description: task.description,
    allDay: task.allDay,
    timezone: task.timezone,
    recurrence: task.recurrence,
    busy: task.busy,
    visibility: task.visibility,
    conferenceUrl: task.conferenceUrl,
    color: task.color,
    guestCanModify: task.guestCanModify,
    guestCanInvite: task.guestCanInvite,
    guestCanSeeOthers: task.guestCanSeeOthers,
    guests: {
      create: task.guests.map((guest) => ({
        email: guest.email,
        name: guest.name,
        response: guest.response,
      })),
    },
    reminders: {
      create: task.reminders.map((reminder) => ({
        minutesBefore: reminder.minutesBefore,
      })),
    },
  };
}

export function expansionWindow(settings?: {
  syncDaysBack?: number | null;
  syncDaysForward?: number | null;
} | null): { start: Date; end: Date } {
  const back = settings?.syncDaysBack ?? DEFAULT_SYNC_DAYS_BACK;
  const forward = settings?.syncDaysForward ?? DEFAULT_SYNC_DAYS_FORWARD;
  const start = new Date();
  start.setDate(start.getDate() - back);
  const end = new Date();
  end.setDate(end.getDate() + forward);
  return { start, end };
}

export function expandRecurringEvent(
  event: EventWithDetails,
  windowStart: Date,
  windowEnd: Date,
): Event[] {
  const dto = toEventDto(event);
  if (!event.recurrence || event.source === EventSource.google) {
    return [dto];
  }

  try {
    const dates = expandRruleDates(
      event.recurrence,
      event.start,
      windowStart,
      windowEnd,
    );
    if (dates.length === 0) return [];
    const duration = event.end.getTime() - event.start.getTime();
    return dates.map((date) => ({
      ...dto,
      id: instanceEventId(event.id, date),
      start: date.toISOString(),
      end: new Date(date.getTime() + duration).toISOString(),
    }));
  } catch {
    return [dto];
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function expandRruleDates(
  recurrence: string,
  dtstart: Date,
  windowStart: Date,
  windowEnd: Date,
): Date[] {
  const parts = parseRrule(recurrence);
  const freq = parts.FREQ;
  if (!freq) return [dtstart];
  const interval = Math.max(1, Number(parts.INTERVAL ?? '1') || 1);
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  const until = parts.UNTIL ? parseRruleUntil(parts.UNTIL) : null;
  const byday = (parts.BYDAY ?? '')
    .split(',')
    .map((day) => day.trim().toUpperCase())
    .filter((day) => day in WEEKDAY_INDEX);

  const dates: Date[] = [];
  let cursor = new Date(dtstart.getTime());
  let emitted = 0;
  const hardCap = 400;

  while (dates.length < hardCap && emitted < hardCap) {
    if (until && cursor.getTime() > until.getTime()) break;
    if (cursor.getTime() > windowEnd.getTime() && (!count || emitted >= (count ?? 0))) {
      if (cursor.getTime() > windowEnd.getTime()) break;
    }
    if (count !== null && emitted >= count) break;
    if (cursor.getTime() > windowEnd.getTime() + 86_400_000) break;

    const matches = occurrenceMatches(cursor, freq, byday, dtstart, interval);
    if (matches) {
      emitted += 1;
      if (cursor.getTime() >= windowStart.getTime() && cursor.getTime() <= windowEnd.getTime()) {
        dates.push(new Date(cursor.getTime()));
      }
      if (count !== null && emitted >= count) break;
    }
    cursor = nextCursor(cursor, freq, interval);
  }
  return dates;
}

function occurrenceMatches(
  cursor: Date,
  freq: string,
  byday: string[],
  dtstart: Date,
  interval: number,
): boolean {
  if (freq === 'WEEKLY') {
    const days =
      byday.length > 0
        ? byday
        : Object.keys(WEEKDAY_INDEX).filter(
            (day) => WEEKDAY_INDEX[day] === dtstart.getUTCDay(),
          );
    if (!days.some((day) => cursor.getUTCDay() === WEEKDAY_INDEX[day])) {
      return false;
    }
    if (interval > 1) {
      const weekDiff = Math.floor(
        (cursor.getTime() - dtstart.getTime()) / (7 * 86_400_000),
      );
      if (weekDiff % interval !== 0) return false;
    }
    return true;
  }
  if (freq === 'MONTHLY') {
    return cursor.getUTCDate() === dtstart.getUTCDate();
  }
  return true;
}

function nextCursor(cursor: Date, freq: string, interval: number): Date {
  const next = new Date(cursor.getTime());
  if (freq === 'DAILY') {
    next.setUTCDate(next.getUTCDate() + interval);
    return next;
  }
  if (freq === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (freq === 'MONTHLY') {
    next.setUTCMonth(next.getUTCMonth() + interval);
    return next;
  }
  next.setUTCDate(next.getUTCDate() + interval);
  return next;
}

function parseRrule(value: string): Record<string, string> {
  const body = value.trim().replace(/^RRULE:/i, '');
  const out: Record<string, string> = {};
  for (const part of body.split(';')) {
    const [key, raw] = part.split('=');
    if (!key || raw === undefined) continue;
    out[key.trim().toUpperCase()] = raw.trim().toUpperCase();
  }
  return out;
}

function parseRruleUntil(value: string): Date | null {
  const compact = value.replace(/Z$/, '');
  if (/^\d{8}T\d{6}$/.test(compact)) {
    const y = Number(compact.slice(0, 4));
    const m = Number(compact.slice(4, 6));
    const d = Number(compact.slice(6, 8));
    const hh = Number(compact.slice(9, 11));
    const mm = Number(compact.slice(11, 13));
    const ss = Number(compact.slice(13, 15));
    return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  }
  if (/^\d{8}$/.test(compact)) {
    const y = Number(compact.slice(0, 4));
    const m = Number(compact.slice(4, 6));
    const d = Number(compact.slice(6, 8));
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
