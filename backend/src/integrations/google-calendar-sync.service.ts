import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskSource } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';

type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type GoogleEventsListResponse = {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
};

export type GoogleCalendarSyncResult = {
  imported: number;
  syncedAt: string;
};

@Injectable()
export class GoogleCalendarSyncService {
  private static readonly SYNC_DAYS_BACK = 30;
  private static readonly SYNC_DAYS_FORWARD = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: GoogleCalendarIntegrationService,
  ) {}

  async syncForUser(userId: string): Promise<GoogleCalendarSyncResult> {
    const accessToken =
      await this.integrationService.getValidAccessToken(userId);

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - GoogleCalendarSyncService.SYNC_DAYS_BACK);
    const timeMax = new Date();
    timeMax.setDate(
      timeMax.getDate() + GoogleCalendarSyncService.SYNC_DAYS_FORWARD,
    );

    const events = await this.fetchPrimaryCalendarEvents(
      accessToken,
      timeMin,
      timeMax,
    );

    let imported = 0;
    for (const event of events) {
      if (!event.id || event.status === 'cancelled') continue;
      const mapped = this.mapEventToTask(userId, event);
      if (!mapped) continue;

      await this.prisma.task.upsert({
        where: {
          userId_googleEventId: {
            userId,
            googleEventId: event.id,
          },
        },
        create: mapped,
        update: {
          name: mapped.name,
          startDate: mapped.startDate,
          endDate: mapped.endDate,
          scheduled: true,
          source: TaskSource.google,
        },
      });
      imported += 1;
    }

    const syncedAt = new Date();
    await this.prisma.googleCalendarIntegration.update({
      where: { userId },
      data: { lastSyncedAt: syncedAt },
    });

    return { imported, syncedAt: syncedAt.toISOString() };
  }

  private async fetchPrimaryCalendarEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: '250',
    });

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

    return data.items ?? [];
  }

  private mapEventToTask(
    userId: string,
    event: GoogleCalendarEvent,
  ): {
    userId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    scheduled: boolean;
    googleEventId: string;
    source: TaskSource;
  } | null {
    if (!event.id) return null;

    const startDate = this.parseGoogleDate(event.start);
    const endDate = this.parseGoogleDate(event.end, true);
    if (!startDate || !endDate) return null;

    return {
      userId,
      name: event.summary?.trim() || 'Untitled event',
      startDate,
      endDate: endDate > startDate ? endDate : startDate,
      scheduled: true,
      googleEventId: event.id,
      source: TaskSource.google,
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
