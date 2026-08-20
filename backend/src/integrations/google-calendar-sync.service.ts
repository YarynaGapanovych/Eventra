import { BadRequestException, Injectable } from '@nestjs/common';
import { EventSource } from '../generated/prisma/client';
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
  colorId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
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
      await this.prisma.event.upsert({
        where: {
          userId_googleEventId: {
            userId,
            googleEventId: event.id,
          },
        },
        create: mapped,
        update: {
          title: mapped.title,
          start: mapped.start,
          end: mapped.end,
          color: mapped.color,
          source: EventSource.google,
          taskId: null,
        },
      });
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
  } | null {
    if (!event.id) return null;

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
    };
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
