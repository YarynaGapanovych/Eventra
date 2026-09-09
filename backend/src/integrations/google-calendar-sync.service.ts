import { BadRequestException, Injectable } from '@nestjs/common';
import { findOverlappingEvents } from '../calendar/event-overlap';
import {
  EventSource,
  EventVisibility,
  GuestResponse,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import {
  GOOGLE_EVENT_COLOR_FALLBACK,
  GOOGLE_EVENT_COLORS,
  resolveGoogleEventColor,
  toGoogleDisplayColor,
} from './google-event-colors';
import type { CalendarOverlapNotice } from './google-calendar.types';

type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  hangoutLink?: string;
  transparency?: string;
  visibility?: string;
  recurrence?: string[];
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: {
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  reminders?: {
    useDefault?: boolean;
    overrides?: { method?: string; minutes?: number }[];
  };
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

type GoogleEventsListResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  error?: { message?: string };
};

type GoogleColorsResponse = {
  event?: Record<string, { background?: string }>;
  error?: { message?: string };
};

type GoogleCalendarListEntry = {
  backgroundColor?: string;
  error?: { message?: string };
};

type GoogleColorContext = {
  eventColors: Record<string, string>;
  calendarColor: string;
};

type GoogleEventsListResult = {
  items: GoogleCalendarEvent[];
  nextSyncToken: string | null;
};

type LinkedEventRow = {
  id: string;
  googleEventId: string;
  source: EventSource;
  taskId: string | null;
  title: string;
  start: Date;
  end: Date;
  location: string | null;
  description: string | null;
  color: string | null;
};

type MappedGoogleEvent = {
  userId: string;
  title: string;
  start: Date;
  end: Date;
  googleEventId: string;
  source: EventSource;
  color: string;
  taskId: null;
  location: string | null;
  description: string | null;
  allDay: boolean;
  timezone: string | null;
  recurrence: string | null;
  busy: boolean;
  visibility: EventVisibility;
  conferenceUrl: string | null;
  guests: { email: string; name: string | null; response: GuestResponse }[];
  reminders: { minutesBefore: number }[];
};

type GuestReminderPayload = Pick<MappedGoogleEvent, 'guests' | 'reminders'>;

export type GoogleCalendarSyncResult = {
  imported: number;
  changed: boolean;
  syncedAt: string;
  overlaps: CalendarOverlapNotice[];
};

class GoogleSyncTokenExpiredError extends Error {
  constructor() {
    super('Google Calendar sync token expired');
    this.name = 'GoogleSyncTokenExpiredError';
  }
}

const STATIC_COLOR_CONTEXT: GoogleColorContext = {
  eventColors: GOOGLE_EVENT_COLORS,
  calendarColor: GOOGLE_EVENT_COLOR_FALLBACK,
};

@Injectable()
export class GoogleCalendarSyncService {
  private static readonly PAGE_SIZE = 250;
  private static readonly MAX_PAGES = 40;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: GoogleCalendarIntegrationService,
  ) {}

  async syncForUser(
    userId: string,
    options?: { incremental?: boolean },
  ): Promise<GoogleCalendarSyncResult> {
    const accessToken =
      await this.integrationService.getValidAccessToken(userId);
    const { syncDaysBack, syncDaysForward, lastSyncedAt } =
      await this.integrationService.getSyncWindow(userId);

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - syncDaysBack);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + syncDaysForward);

    const updatedMin =
      options?.incremental === true && lastSyncedAt
        ? new Date(lastSyncedAt.getTime() - 120_000)
        : null;

    if (updatedMin) {
      try {
        return await this.runSync(userId, accessToken, {
          mode: 'incremental',
          updatedMin,
          timeMin,
          timeMax,
        });
      } catch (err) {
        if (
          !(err instanceof GoogleSyncTokenExpiredError) &&
          !(err instanceof BadRequestException)
        ) {
          throw err;
        }
      }
    }

    return this.runSync(userId, accessToken, {
      mode: 'full',
      timeMin,
      timeMax,
    });
  }

  private async runSync(
    userId: string,
    accessToken: string,
    options: {
      mode: 'full' | 'incremental';
      updatedMin?: Date;
      timeMin: Date;
      timeMax: Date;
    },
  ): Promise<GoogleCalendarSyncResult> {
    const { mode, timeMin, timeMax } = options;
    const incremental = mode === 'incremental';

    const [list, colorContext] = await Promise.all([
      incremental
        ? this.fetchUpdatedEvents(
            accessToken,
            timeMin,
            timeMax,
            options.updatedMin!,
          )
        : this.fetchPrimaryCalendarEvents(accessToken, timeMin, timeMax),
      incremental
        ? Promise.resolve(STATIC_COLOR_CONTEXT)
        : this.fetchColorContext(accessToken),
    ]);

    const existingRows = await this.prisma.event.findMany({
      where: { userId, googleEventId: { not: null } },
      select: {
        id: true,
        googleEventId: true,
        source: true,
        taskId: true,
        title: true,
        start: true,
        end: true,
        location: true,
        description: true,
        color: true,
      },
    });
    const existingByGoogleId = new Map<string, LinkedEventRow>();
    const existingTimes = new Map<string, { start: number; end: number }>();
    for (const row of existingRows) {
      if (!row.googleEventId) continue;
      existingByGoogleId.set(row.googleEventId, {
        id: row.id,
        googleEventId: row.googleEventId,
        source: row.source,
        taskId: row.taskId,
        title: row.title,
        start: row.start,
        end: row.end,
        location: row.location,
        description: row.description,
        color: row.color,
      });
      existingTimes.set(row.googleEventId, {
        start: row.start.getTime(),
        end: row.end.getTime(),
      });
    }

    const seenIds = new Set<string>();
    const changedGoogleIds = new Set<string>();
    let imported = 0;
    let changed = false;

    for (const event of list.items) {
      if (!event.id) continue;

      if (event.status === 'cancelled') {
        const deleted = await this.deleteLinkedGoogleEvent(
          userId,
          event.id,
          existingByGoogleId.get(event.id),
          timeMin,
          timeMax,
        );
        if (deleted) {
          existingByGoogleId.delete(event.id);
          existingTimes.delete(event.id);
          changed = true;
        }
        continue;
      }

      const mapped = this.mapGoogleEvent(userId, event, colorContext);
      if (!mapped) continue;

      const existing = existingByGoogleId.get(event.id);
      const fieldsChanged =
        !existing || this.mappedFieldsChanged(existing, mapped);
      if (existing?.source === EventSource.eventra) {
        if (!fieldsChanged) {
          seenIds.add(event.id);
          continue;
        }
        await this.updateEventraExport(existing, mapped);
        seenIds.add(event.id);
        imported += 1;
        changed = true;
        this.trackTimeChange(changedGoogleIds, event.id, existingTimes, mapped);
        continue;
      }

      if (
        !this.inSyncWindow(mapped.start, timeMin, timeMax) &&
        incremental
      ) {
        if (existing) {
          await this.prisma.event.delete({ where: { id: existing.id } });
          existingByGoogleId.delete(event.id);
          existingTimes.delete(event.id);
          changed = true;
        }
        continue;
      }

      seenIds.add(event.id);
      if (existing && !fieldsChanged) {
        continue;
      }
      const { guests, reminders, ...scalars } = mapped;
      this.trackTimeChange(changedGoogleIds, event.id, existingTimes, mapped);
      const row = await this.prisma.event.upsert({
        where: {
          userId_googleEventId: {
            userId,
            googleEventId: event.id,
          },
        },
        create: scalars,
        update: {
          title: scalars.title,
          start: scalars.start,
          end: scalars.end,
          color: scalars.color,
          source: EventSource.google,
          taskId: null,
          location: scalars.location,
          description: scalars.description,
          allDay: scalars.allDay,
          timezone: scalars.timezone,
          recurrence: scalars.recurrence,
          busy: scalars.busy,
          visibility: scalars.visibility,
          conferenceUrl: scalars.conferenceUrl,
        },
      });
      await this.replaceGuestsAndReminders(row.id, { guests, reminders });
      imported += 1;
      changed = true;
    }

    if (!incremental) {
      const prunedGoogle = await this.pruneMissingGoogleEvents(
        userId,
        timeMin,
        timeMax,
        seenIds,
      );
      const prunedExports = await this.pruneMissingEventraExports(
        userId,
        timeMin,
        timeMax,
        seenIds,
      );
      const prunedOutside = await this.pruneGoogleEventsOutsideWindow(
        userId,
        timeMin,
        timeMax,
      );
      if (prunedGoogle + prunedExports + prunedOutside > 0) {
        changed = true;
      }
    }

    const overlaps = await this.collectOverlapNotices(userId, changedGoogleIds);
    if (overlaps.length > 0) {
      await this.integrationService.mergePendingOverlapNotices(userId, overlaps);
    }

    const syncedAt = new Date();
    await this.integrationService.persistSyncMeta(userId, {
      lastSyncedAt: syncedAt,
      googleSyncToken: incremental ? undefined : (list.nextSyncToken ?? null),
    });

    return {
      imported,
      changed,
      syncedAt: syncedAt.toISOString(),
      overlaps,
    };
  }

  private mappedFieldsChanged(
    existing: LinkedEventRow,
    mapped: MappedGoogleEvent,
  ): boolean {
    return (
      existing.title !== mapped.title ||
      existing.start.getTime() !== mapped.start.getTime() ||
      existing.end.getTime() !== mapped.end.getTime() ||
      (existing.location ?? null) !== mapped.location ||
      (existing.description ?? null) !== mapped.description ||
      (existing.color ?? null) !== mapped.color
    );
  }

  private trackTimeChange(
    changedGoogleIds: Set<string>,
    googleEventId: string,
    existingTimes: Map<string, { start: number; end: number }>,
    mapped: MappedGoogleEvent,
  ): void {
    const previous = existingTimes.get(googleEventId);
    const timesChanged =
      !previous ||
      previous.start !== mapped.start.getTime() ||
      previous.end !== mapped.end.getTime();
    if (timesChanged && mapped.busy !== false) {
      changedGoogleIds.add(googleEventId);
    }
  }

  private inSyncWindow(start: Date, timeMin: Date, timeMax: Date): boolean {
    const t = start.getTime();
    return t >= timeMin.getTime() && t <= timeMax.getTime();
  }

  private async deleteLinkedGoogleEvent(
    userId: string,
    googleEventId: string,
    existing: LinkedEventRow | undefined,
    timeMin: Date,
    timeMax: Date,
  ): Promise<boolean> {
    if (!existing) {
      const removed = await this.prisma.event.deleteMany({
        where: { userId, googleEventId, source: EventSource.google },
      });
      return removed.count > 0;
    }

    if (existing.source === EventSource.eventra) {
      if (!this.inSyncWindow(existing.start, timeMin, timeMax)) {
        return false;
      }
      await this.prisma.event.delete({ where: { id: existing.id } });
      return true;
    }

    await this.prisma.event.delete({ where: { id: existing.id } });
    return true;
  }

  private async updateEventraExport(
    existing: LinkedEventRow,
    mapped: MappedGoogleEvent,
  ): Promise<void> {
    await this.prisma.event.update({
      where: { id: existing.id },
      data: {
        title: mapped.title,
        start: mapped.start,
        end: mapped.end,
        color: mapped.color,
        location: mapped.location,
        description: mapped.description,
        allDay: mapped.allDay,
        timezone: mapped.timezone,
        recurrence: mapped.recurrence,
        busy: mapped.busy,
        visibility: mapped.visibility,
        conferenceUrl: mapped.conferenceUrl,
      },
    });
    await this.replaceGuestsAndReminders(existing.id, mapped);
    if (existing.taskId) {
      await this.prisma.task.update({
        where: { id: existing.taskId },
        data: {
          name: mapped.title,
          start: mapped.start,
          end: mapped.end,
          location: mapped.location,
          description: mapped.description,
          allDay: mapped.allDay,
          timezone: mapped.timezone,
          recurrence: mapped.recurrence,
          color: mapped.color,
          busy: mapped.busy,
          visibility: mapped.visibility,
          conferenceUrl: mapped.conferenceUrl,
        },
      });
    }
  }

  private async replaceGuestsAndReminders(
    eventId: string,
    payload: GuestReminderPayload,
  ): Promise<void> {
    await this.prisma.eventGuest.deleteMany({ where: { eventId } });
    if (payload.guests.length > 0) {
      await this.prisma.eventGuest.createMany({
        data: payload.guests.map((guest) => ({ ...guest, eventId })),
      });
    }
    await this.prisma.eventReminder.deleteMany({ where: { eventId } });
    if (payload.reminders.length > 0) {
      await this.prisma.eventReminder.createMany({
        data: payload.reminders.map((reminder) => ({
          ...reminder,
          eventId,
        })),
      });
    }
  }

  private async collectOverlapNotices(
    userId: string,
    changedGoogleIds: Set<string>,
  ): Promise<CalendarOverlapNotice[]> {
    if (changedGoogleIds.size === 0) return [];

    const allEvents = await this.prisma.event.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        busy: true,
        googleEventId: true,
      },
    });

    const notices: CalendarOverlapNotice[] = [];
    for (const event of allEvents) {
      if (!event.googleEventId || !changedGoogleIds.has(event.googleEventId)) {
        continue;
      }
      if (event.busy === false) continue;
      const overlapping = findOverlappingEvents(allEvents, event, {
        excludeId: event.id,
      });
      if (overlapping.length === 0) continue;
      notices.push({
        id: `overlap:${event.googleEventId}:${overlapping
          .map((item) => item.id)
          .sort()
          .join(',')}`,
        title: event.title,
        overlappingTitles: overlapping.map((item) => item.title),
        start: event.start.toISOString(),
        end: event.end.toISOString(),
      });
    }
    return notices;
  }

  private async fetchColorContext(
    accessToken: string,
  ): Promise<GoogleColorContext> {
    const [eventColors, calendarColor] = await Promise.all([
      this.fetchEventColors(accessToken),
      this.fetchPrimaryCalendarColor(accessToken),
    ]);
    return { eventColors, calendarColor };
  }

  private async fetchEventColors(
    accessToken: string,
  ): Promise<Record<string, string>> {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/colors', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as GoogleColorsResponse;
      if (!res.ok) return { ...GOOGLE_EVENT_COLORS };

      const fromApi: Record<string, string> = { ...GOOGLE_EVENT_COLORS };
      for (const [id, value] of Object.entries(data.event ?? {})) {
        const hex = toGoogleDisplayColor(value.background);
        if (hex) fromApi[id] = hex;
      }
      return fromApi;
    } catch {
      return { ...GOOGLE_EVENT_COLORS };
    }
  }

  private async fetchPrimaryCalendarColor(accessToken: string): Promise<string> {
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = (await res.json()) as GoogleCalendarListEntry;
      if (!res.ok) return GOOGLE_EVENT_COLOR_FALLBACK;
      return (
        toGoogleDisplayColor(data.backgroundColor) ?? GOOGLE_EVENT_COLOR_FALLBACK
      );
    } catch {
      return GOOGLE_EVENT_COLOR_FALLBACK;
    }
  }

  private async fetchPrimaryCalendarEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<GoogleEventsListResult> {
    const params = new URLSearchParams({
      singleEvents: 'true',
      showDeleted: 'true',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: String(GoogleCalendarSyncService.PAGE_SIZE),
    });
    return this.fetchCalendarEventPages(accessToken, params);
  }

  private async fetchUpdatedEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
    updatedMin: Date,
  ): Promise<GoogleEventsListResult> {
    const params = new URLSearchParams({
      singleEvents: 'true',
      showDeleted: 'true',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      updatedMin: updatedMin.toISOString(),
      maxResults: String(GoogleCalendarSyncService.PAGE_SIZE),
    });
    return this.fetchCalendarEventPages(accessToken, params);
  }

  private async fetchCalendarEventPages(
    accessToken: string,
    baseParams: URLSearchParams,
  ): Promise<GoogleEventsListResult> {
    const items: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    for (let page = 0; page < GoogleCalendarSyncService.MAX_PAGES; page += 1) {
      const params = new URLSearchParams(baseParams);
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (res.status === 410 || (res.status === 400 && baseParams.has('syncToken'))) {
        throw new GoogleSyncTokenExpiredError();
      }

      const data = (await res.json()) as GoogleEventsListResponse;
      if (!res.ok) {
        throw new BadRequestException(
          data.error?.message ?? 'Failed to fetch Google Calendar events',
        );
      }

      items.push(...(data.items ?? []));
      pageToken = data.nextPageToken?.trim() || undefined;
      if (!pageToken) {
        nextSyncToken = data.nextSyncToken?.trim() || null;
        break;
      }
    }

    return { items, nextSyncToken };
  }

  private async pruneMissingGoogleEvents(
    userId: string,
    timeMin: Date,
    timeMax: Date,
    seenIds: Set<string>,
  ): Promise<number> {
    const windowFilter = {
      userId,
      source: EventSource.google,
      start: { gte: timeMin, lte: timeMax },
    };

    if (seenIds.size === 0) {
      const result = await this.prisma.event.deleteMany({
        where: windowFilter,
      });
      return result.count;
    }

    const result = await this.prisma.event.deleteMany({
      where: {
        ...windowFilter,
        googleEventId: { notIn: [...seenIds] },
      },
    });
    return result.count;
  }

  private async pruneMissingEventraExports(
    userId: string,
    timeMin: Date,
    timeMax: Date,
    seenIds: Set<string>,
  ): Promise<number> {
    const windowFilter = {
      userId,
      source: EventSource.eventra,
      googleEventId: { not: null },
      start: { gte: timeMin, lte: timeMax },
    };

    if (seenIds.size === 0) {
      const result = await this.prisma.event.deleteMany({
        where: windowFilter,
      });
      return result.count;
    }

    const result = await this.prisma.event.deleteMany({
      where: {
        ...windowFilter,
        googleEventId: { notIn: [...seenIds] },
      },
    });
    return result.count;
  }

  private async pruneGoogleEventsOutsideWindow(
    userId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<number> {
    const result = await this.prisma.event.deleteMany({
      where: {
        userId,
        source: EventSource.google,
        OR: [{ start: { lt: timeMin } }, { start: { gt: timeMax } }],
      },
    });
    return result.count;
  }

  private mapGoogleEvent(
    userId: string,
    event: GoogleCalendarEvent,
    colors: GoogleColorContext,
  ): MappedGoogleEvent | null {
    if (!event.id) return null;

    const allDay = Boolean(event.start?.date && !event.start?.dateTime);
    const start = this.parseGoogleDate(event.start);
    const end = this.parseGoogleDate(event.end, true);
    if (!start || !end) return null;

    return {
      userId,
      title: event.summary?.trim() || 'Untitled event',
      start,
      end: end > start ? end : start,
      googleEventId: event.id,
      source: EventSource.google,
      color: resolveGoogleEventColor(
        event.colorId,
        colors.eventColors,
        colors.calendarColor,
      ),
      taskId: null,
      location: event.location?.trim() || null,
      description: event.description?.trim() || null,
      allDay,
      timezone: event.start?.timeZone?.trim() || null,
      recurrence: this.mapRecurrence(event.recurrence),
      busy: event.transparency !== 'transparent',
      visibility: this.mapVisibility(event.visibility),
      conferenceUrl: this.mapConferenceUrl(event),
      guests: this.mapAttendees(event.attendees),
      reminders: this.mapReminders(event.reminders),
    };
  }

  private mapRecurrence(recurrence?: string[]): string | null {
    if (!recurrence?.length) return null;
    const rule = recurrence.find((line) =>
      line.toUpperCase().startsWith('RRULE:'),
    );
    if (!rule) return recurrence[0] ?? null;
    return rule.replace(/^RRULE:/i, '');
  }

  private mapVisibility(value?: string): EventVisibility {
    if (value === 'public') return EventVisibility.public;
    if (value === 'private' || value === 'confidential') {
      return EventVisibility.private;
    }
    return EventVisibility.default;
  }

  private mapConferenceUrl(event: GoogleCalendarEvent): string | null {
    const hangout = event.hangoutLink?.trim();
    if (hangout) return hangout;
    const video = event.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video' && entry.uri,
    );
    return video?.uri?.trim() || null;
  }

  private mapAttendees(
    attendees?: GoogleCalendarEvent['attendees'],
  ): { email: string; name: string | null; response: GuestResponse }[] {
    if (!attendees?.length) return [];
    const seen = new Set<string>();
    const rows: {
      email: string;
      name: string | null;
      response: GuestResponse;
    }[] = [];
    for (const attendee of attendees) {
      const email = attendee.email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      rows.push({
        email,
        name: attendee.displayName?.trim() || null,
        response: this.mapGuestResponse(attendee.responseStatus),
      });
    }
    return rows;
  }

  private mapGuestResponse(value?: string): GuestResponse {
    if (value === 'accepted') return GuestResponse.accepted;
    if (value === 'declined') return GuestResponse.declined;
    if (value === 'tentative') return GuestResponse.tentative;
    return GuestResponse.needsAction;
  }

  private mapReminders(
    reminders?: GoogleCalendarEvent['reminders'],
  ): { minutesBefore: number }[] {
    const overrides = reminders?.overrides ?? [];
    const fromOverrides = overrides
      .map((item) => item.minutes)
      .filter(
        (minutes): minutes is number =>
          typeof minutes === 'number' &&
          Number.isInteger(minutes) &&
          minutes >= 0,
      );
    if (fromOverrides.length > 0) {
      return [...new Set(fromOverrides)].map((minutesBefore) => ({
        minutesBefore,
      }));
    }
    if (reminders?.useDefault) {
      return [{ minutesBefore: 10 }];
    }
    return [];
  }

  private parseGoogleDate(
    part?: { dateTime?: string; date?: string },
    isEnd = false,
  ): Date | null {
    if (!part) return null;
    if (part.dateTime) {
      const d = new Date(part.dateTime);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (part.date) {
      const [y, m, d] = part.date.split('-').map(Number);
      if (!y || !m || !d) return null;
      if (isEnd) {
        const end = new Date(Date.UTC(y, m - 1, d));
        end.setUTCDate(end.getUTCDate() - 1);
        end.setUTCHours(23, 59, 59, 999);
        return end;
      }
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
    return null;
  }
}
