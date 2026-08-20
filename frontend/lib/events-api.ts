export type EventSource = "eventra" | "google";

export type ApiEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  source: EventSource;
  googleEventId: string | null;
  taskId: string | null;
};

export type CreateEventInput = {
  title: string;
  start: string;
  end: string;
};

export type UpdateEventInput = Partial<{
  title: string;
  start: string;
  end: string;
}>;

export type ScheduleTaskInput = {
  taskId: string;
  start: string;
  end: string;
};

export function normalizeApiEvent(event: ApiEvent): ApiEvent {
  return {
    ...event,
    source: event.source === "google" ? "google" : "eventra",
  };
}
