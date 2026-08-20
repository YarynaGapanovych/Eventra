import { BadRequestException, Injectable } from '@nestjs/common';
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

export type GoogleCalendarSyncResult = {
  imported: number;
  syncedAt: string;
};

@Injectable()
export class GoogleCalendarSyncService {
  private static readonly PAGE_SIZE = 250;
  private static readonly MAX_PAGES = 40;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: GoogleCalendarIntegrationService,
  ) {}

  async syncForUser(userId: string): Promise<GoogleCalendarSyncResult> {
    const accessToken =
      await this.integrationService.getValidAccessToken(userId);
    const { syncDaysBack, syncDaysForward } =
      await this.integrationService.getSyncWindow(userId);

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - syncDaysBack);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + syncDaysForward);

    const [events, colorContext] = await Promise.all([
      this.fetchPrimaryCalendarEvents(accessToken, timeMin, timeMax),
      this.fetchColorContext(accessToken),
    ]);

    const seenIds = new Set<string>();
    let imported = 0;
    for (const event of events) {
      if (!event.id || event.status === 'cancelled') continue;
      const mapped = this.mapGoogleEvent(userId, event, colorContext);
      if (!mapped) continue;

      seenIds.add(event.id);
      const { guests, reminders, ...scalars } = mapped;
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
      await this.prisma.eventGuest.deleteMany({ where: { eventId: row.id } });
      if (guests.length > 0) {
        await this.prisma.eventGuest.createMany({
          data: guests.map((guest) => ({ ...guest, eventId: row.id })),
        });
      }
      await this.prisma.eventReminder.deleteMany({
        where: { eventId: row.id },
      });
      if (reminders.length > 0) {
        await this.prisma.eventReminder.createMany({
          data: reminders.map((reminder) => ({
            ...reminder,
            eventId: row.id,
          })),
        });
      }
      imported += 1;
    }

    await this.pruneMissingGoogleEvents(userId, timeMin, timeMax, seenIds);
    await this.pruneGoogleEventsOutsideWindow(userId, timeMin, timeMax);

    const syncedAt = new Date();
    await this.prisma.googleCalendarIntegration.update({
      where: { userId },
      data: { lastSyncedAt: syncedAt },
    });

    return { imported, syncedAt: syncedAt.toISOString() };
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
  ): Promise<GoogleCalendarEvent[]> {
    const items: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < GoogleCalendarSyncService.MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: String(GoogleCalendarSyncService.PAGE_SIZE),
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const data = (await res.json()) as GoogleEventsListResponse;
      if (!res.ok) {
        throw new BadRequestException(
          data.error?.message ?? 'Failed to fetch Google Calendar events',
        );
      }

      items.push(...(data.items ?? []));
      pageToken = data.nextPageToken?.trim() || undefined;
      if (!pageToken) break;
    }

    return items;
  }

  private async pruneMissingGoogleEvents(
    userId: string,
    timeMin: Date,
    timeMax: Date,
    seenIds: Set<string>,
  ): Promise<void> {
    const windowFilter = {
      userId,
      source: EventSource.google,
      start: { gte: timeMin, lte: timeMax },
    };

    if (seenIds.size === 0) {
      await this.prisma.event.deleteMany({ where: windowFilter });
      return;
    }

    await this.prisma.event.deleteMany({
      where: {
        ...windowFilter,
        googleEventId: { notIn: [...seenIds] },
      },
    });
  }

  private async pruneGoogleEventsOutsideWindow(
    userId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<void> {
    await this.prisma.event.deleteMany({
      where: {
        userId,
        source: EventSource.google,
        OR: [{ start: { lt: timeMin } }, { start: { gt: timeMax } }],
      },
    });
  }

  private mapGoogleEvent(
    userId: string,
    event: GoogleCalendarEvent,
    colors: GoogleColorContext,
  ): {
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
  } | null {
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
