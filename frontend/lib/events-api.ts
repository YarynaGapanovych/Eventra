import {
  EMPTY_CALENDAR_DETAILS,
  withCalendarDefaults,
  type CalendarDetails,
  type CalendarDetailsInput,
} from "@/lib/calendar-details";

export type EventSource = "eventra" | "google";

export type ApiEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  source: EventSource;
  googleEventId: string | null;
  color: string | null;
  taskId: string | null;
} & CalendarDetails;

export type CreateEventInput = {
  title: string;
  start: string;
  end: string;
} & CalendarDetailsInput;

export type UpdateEventInput = Partial<{
  title: string;
  start: string;
  end: string;
}> & CalendarDetailsInput;

export type ScheduleTaskInput = {
  taskId: string;
  start: string;
  end: string;
};

export function normalizeApiEvent(event: ApiEvent): ApiEvent {
  return {
    ...EMPTY_CALENDAR_DETAILS,
    ...event,
    ...withCalendarDefaults(event),
    source: event.source === "google" ? "google" : "eventra",
    color: event.color ?? null,
  };
}
