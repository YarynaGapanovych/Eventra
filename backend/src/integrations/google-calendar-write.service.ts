import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EventVisibility,
  GuestResponse,
} from '../generated/prisma/client';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import { hexToGoogleColorId } from './google-event-colors';

export type GoogleCalendarWriteEvent = {
  title: string;
  start: Date;
  end: Date;
  location: string | null;
  description: string | null;
  allDay: boolean;
  timezone: string | null;
  recurrence: string | null;
  busy: boolean;
  visibility: EventVisibility;
  color: string | null;
  guestCanModify: boolean;
  guestCanInvite: boolean;
  guestCanSeeOthers: boolean;
  guests: {
    email: string;
    name: string | null;
    response: GuestResponse;
  }[];
  reminders: { minutesBefore: number }[];
};

type GoogleDatePart = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GooglePatchBody = {
  summary: string;
  description: string;
  location: string;
  start: GoogleDatePart;
  end: GoogleDatePart;
  transparency: 'opaque' | 'transparent';
  visibility: 'default' | 'public' | 'private';
  guestsCanModify: boolean;
  guestsCanInviteOthers: boolean;
  guestsCanSeeOtherGuests: boolean;
  attendees: {
    email: string;
    displayName?: string;
    responseStatus: string;
  }[];
  reminders: {
    useDefault: boolean;
    overrides: { method: 'popup'; minutes: number }[];
  };
  colorId?: string;
  recurrence?: string[];
};

type GoogleApiErrorBody = {
  error?: { message?: string; code?: number };
};

type GoogleEventCreateResponse = {
  id?: string;
};

export function toGoogleWriteEvent(event: {
  title: string;
  start: Date;
  end: Date;
  location: string | null;
  description: string | null;
  allDay: boolean;
  timezone: string | null;
  recurrence: string | null;
  busy: boolean;
  visibility: EventVisibility;
  color: string | null;
  guestCanModify: boolean;
  guestCanInvite: boolean;
  guestCanSeeOthers: boolean;
  guests: {
    email: string;
    name: string | null;
    response: GuestResponse;
  }[];
  reminders: { minutesBefore: number }[];
}): GoogleCalendarWriteEvent {
  return {
    title: event.title,
    start: event.start,
    end: event.end,
    location: event.location,
    description: event.description,
    allDay: event.allDay,
    timezone: event.timezone,
    recurrence: event.recurrence,
    busy: event.busy,
    visibility: event.visibility,
    color: event.color,
    guestCanModify: event.guestCanModify,
    guestCanInvite: event.guestCanInvite,
    guestCanSeeOthers: event.guestCanSeeOthers,
    guests: event.guests.map((guest) => ({
      email: guest.email,
      name: guest.name,
      response: guest.response,
    })),
    reminders: event.reminders.map((reminder) => ({
      minutesBefore: reminder.minutesBefore,
    })),
  };
}

@Injectable()
export class GoogleCalendarWriteService {
  constructor(
    private readonly integrationService: GoogleCalendarIntegrationService,
  ) {}

  async createEvent(
    userId: string,
    event: GoogleCalendarWriteEvent,
  ): Promise<string> {
    const accessToken =
      await this.integrationService.getValidAccessToken(userId);
    const res = await fetch(this.eventsUrl('all'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.toPatchBody(event)),
    });
    if (!res.ok) {
      throw new BadRequestException(
        await this.errorMessage(res, 'Failed to create Google Calendar event'),
      );
    }
    const data = (await res.json()) as GoogleEventCreateResponse;
    if (!data.id?.trim()) {
      throw new BadRequestException(
        'Google Calendar did not return an event id.',
      );
    }
    return data.id;
  }

  async createEventraCopyIfEnabled(
    userId: string,
    event: GoogleCalendarWriteEvent,
  ): Promise<string | null> {
    const enabled = await this.integrationService.isExportEnabled(userId);
    if (!enabled) return null;
    return this.createEvent(userId, event);
  }

  async patchEvent(
    userId: string,
    googleEventId: string,
    event: GoogleCalendarWriteEvent,
  ): Promise<void> {
    const accessToken =
      await this.integrationService.getValidAccessToken(userId);
    const res = await fetch(this.eventUrl(googleEventId, 'all'), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.toPatchBody(event)),
    });
    if (!res.ok) {
      throw new BadRequestException(
        await this.errorMessage(res, 'Failed to update Google Calendar event'),
      );
    }
  }

  async deleteEvent(userId: string, googleEventId: string): Promise<void> {
    const accessToken =
      await this.integrationService.getValidAccessToken(userId);
    const res = await fetch(this.eventUrl(googleEventId, 'all'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok || res.status === 404 || res.status === 410) return;
    throw new BadRequestException(
      await this.errorMessage(res, 'Failed to delete Google Calendar event'),
    );
  }

  private eventsUrl(sendUpdates: 'all' | 'none'): string {
    const params = new URLSearchParams({ sendUpdates });
    return `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  }

  private eventUrl(
    googleEventId: string,
    sendUpdates: 'all' | 'none',
  ): string {
    const params = new URLSearchParams({ sendUpdates });
    return `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}?${params.toString()}`;
  }

  private toPatchBody(event: GoogleCalendarWriteEvent): GooglePatchBody {
    const body: GooglePatchBody = {
      summary: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      start: this.toGoogleDate(event.start, event.allDay, event.timezone, false),
      end: this.toGoogleDate(event.end, event.allDay, event.timezone, true),
      transparency: event.busy === false ? 'transparent' : 'opaque',
      visibility: this.toGoogleVisibility(event.visibility),
      guestsCanModify: event.guestCanModify,
      guestsCanInviteOthers: event.guestCanInvite,
      guestsCanSeeOtherGuests: event.guestCanSeeOthers,
      attendees: event.guests.map((guest) => ({
        email: guest.email,
        ...(guest.name ? { displayName: guest.name } : {}),
        responseStatus: this.toGoogleResponse(guest.response),
      })),
      reminders: {
        useDefault: false,
        overrides: event.reminders.map((reminder) => ({
          method: 'popup' as const,
          minutes: reminder.minutesBefore,
        })),
      },
    };

    const colorId = hexToGoogleColorId(event.color);
    if (colorId) body.colorId = colorId;

    const recurrence = this.toGoogleRecurrence(event.recurrence);
    if (recurrence) body.recurrence = recurrence;

    return body;
  }

  private toGoogleDate(
    date: Date,
    allDay: boolean,
    timeZone: string | null,
    isEnd: boolean,
  ): GoogleDatePart {
    if (allDay) {
      if (isEnd) {
        const exclusive = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1,
          ),
        );
        return { date: utcDateString(exclusive) };
      }
      return { date: utcDateString(date) };
    }
    return {
      dateTime: date.toISOString(),
      ...(timeZone ? { timeZone } : {}),
    };
  }

  private toGoogleVisibility(
    visibility: EventVisibility,
  ): 'default' | 'public' | 'private' {
    if (visibility === EventVisibility.public) return 'public';
    if (visibility === EventVisibility.private) return 'private';
    return 'default';
  }

  private toGoogleResponse(response: GuestResponse): string {
    if (response === GuestResponse.accepted) return 'accepted';
    if (response === GuestResponse.declined) return 'declined';
    if (response === GuestResponse.tentative) return 'tentative';
    return 'needsAction';
  }

  private toGoogleRecurrence(recurrence: string | null): string[] | null {
    const rule = recurrence?.trim();
    if (!rule) return null;
    return [rule.toUpperCase().startsWith('RRULE:') ? rule : `RRULE:${rule}`];
  }

  private async errorMessage(
    res: Response,
    fallback: string,
  ): Promise<string> {
    try {
      const data = (await res.json()) as GoogleApiErrorBody;
      return data.error?.message?.trim() || fallback;
    } catch {
      return fallback;
    }
  }
}

function utcDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
