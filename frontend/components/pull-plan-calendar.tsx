"use client";

import { CalendarCreateEventModal } from "@/components/calendar-create-event-modal";
import { Button } from "@/components/ui/button";
import { getStoredAuth } from "@/lib/auth-api";
import {
  useGoogleCalendarStatusQuery,
  useSyncGoogleCalendarMutation,
} from "@/hooks/use-google-calendar";
import {
  useCreateEventMutation,
  useEventsQuery,
  useScheduleTaskMutation,
  useUpdateEventMutation,
} from "@/hooks/use-events";
import { useTasksQuery } from "@/hooks/use-tasks";
import { type ApiEvent } from "@/lib/events-api";
import { type ApiTask } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { CalendarPlus, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import {
  Calendar,
  mapEventToTask,
  ProgressStatus,
  type CalendarEvent,
  type CalendarEventCreatePayload,
  type CalendarEventMovePayload,
  type CalendarEventResizePayload,
  type CalendarViewMode,
  type Task,
  type TaskModalProps,
} from "pull-plan-calendar";
import "pull-plan-calendar/dist/calendar.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const calendarNavIconClass = "size-4 shrink-0";
const GOOGLE_EVENT_COLOR = "#4285F4";
const TASK_BLOCK_COLOR = "#0f766e";
const CALENDAR_VIEW_STORAGE_KEY = "eventra.calendar.view.v1";
const UNSCHEDULED_PREFIX = "task:";
const CALENDAR_VIEWS: readonly CalendarViewMode[] = [
  "day",
  "week",
  "month",
  "year",
];

function isCalendarViewMode(value: string): value is CalendarViewMode {
  return (CALENDAR_VIEWS as readonly string[]).includes(value);
}

function readStoredCalendarView(): CalendarViewMode {
  try {
    const stored = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
    if (stored && isCalendarViewMode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "day";
}

function writeStoredCalendarView(view: CalendarViewMode): void {
  try {
    window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}

function CalendarAddEventButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="icon" onClick={onClick} aria-label="Add event">
      <CalendarPlus className="size-4" aria-hidden />
    </Button>
  );
}

function CalendarEventActionButton({
  event,
  onOpen,
}: {
  event: CalendarEvent;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen();
      }}
      aria-label={`View ${event.title}`}
    >
      <Eye className="size-3.5" aria-hidden />
      View
    </Button>
  );
}

function CalendarEventDetailModal({
  task,
  isOpen,
  onClose,
  className,
}: TaskModalProps) {
  if (!isOpen) return null;

  const source = typeof task.source === "string" ? task.source : null;
  const kind = typeof task.kind === "string" ? task.kind : null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-detail-title"
    >
      <Button
        type="button"
        variant="ghost"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 z-0 h-full min-h-0 w-full cursor-default rounded-none border-0 bg-zinc-950/40 p-0 shadow-none ring-0 backdrop-blur-sm hover:bg-zinc-950/45 focus-visible:ring-0 dark:bg-black/50 dark:hover:bg-black/55"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="calendar-event-detail-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {kind === "unscheduled-task" ? "Unscheduled task" : "Event details"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="mt-3 font-medium text-zinc-900 dark:text-zinc-50">
          {task.name}
        </p>
        {source === "google" ? (
          <p className="mt-1 text-xs font-medium text-[#4285F4]">
            Google Calendar
          </p>
        ) : kind === "task-block" ? (
          <p className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-400">
            Scheduled task
          </p>
        ) : null}
        {kind !== "unscheduled-task" ? (
          <>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Start: {dayjs(task.startDate).format("MMM D, YYYY h:mm A")}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              End: {dayjs(task.endDate).format("MMM D, YYYY h:mm A")}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Drag onto the calendar to schedule a time block.
          </p>
        )}
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function toScheduledCalendarEvent(event: ApiEvent): CalendarEvent {
  const color =
    event.source === "google"
      ? GOOGLE_EVENT_COLOR
      : event.taskId
        ? TASK_BLOCK_COLOR
        : undefined;
  return {
    id: event.id,
    title: event.title,
    start: dayjs(event.start),
    end: dayjs(event.end),
    color,
    meta: {
      source: event.source,
      taskId: event.taskId,
      kind: event.taskId ? "task-block" : "event",
    },
  };
}

function toUnscheduledCalendarEvent(task: ApiTask): CalendarEvent {
  const now = dayjs();
  return {
    id: `${UNSCHEDULED_PREFIX}${task.id}`,
    title: task.name,
    start: now,
    end: now.add(1, "hour"),
    meta: {
      kind: "unscheduled-task",
      taskId: task.id,
      source: "eventra",
    },
  };
}

function mapCalendarEventToLibraryTask(event: CalendarEvent): Task {
  const mapped = mapEventToTask(event);
  return {
    ...mapped,
    progressStatus: ProgressStatus.NOT_STARTED,
    source: event.meta?.source,
    kind: event.meta?.kind,
    taskId: event.meta?.taskId,
  };
}

function unscheduledTaskId(calendarEventId: string): string | null {
  if (!calendarEventId.startsWith(UNSCHEDULED_PREFIX)) return null;
  return calendarEventId.slice(UNSCHEDULED_PREFIX.length);
}

export function PullPlanCalendar() {
  const [view, setView] = useState<CalendarViewMode>("day");
  const [actionError, setActionError] = useState<string | null>(null);
  const calendarRootRef = useRef<HTMLDivElement>(null);
  const {
    data: tasks = [],
    error: tasksError,
  } = useTasksQuery({ refetchInterval: 2500 });
  const {
    data: events = [],
    error: eventsError,
  } = useEventsQuery({ refetchInterval: 2500 });
  const calendarStatusQuery = useGoogleCalendarStatusQuery();
  const syncMutation = useSyncGoogleCalendarMutation();
  const createEventMutation = useCreateEventMutation();
  const updateEventMutation = useUpdateEventMutation();
  const scheduleTaskMutation = useScheduleTaskMutation();
  const initialSyncStarted = useRef(false);
  const error =
    actionError ??
    (tasksError instanceof Error
      ? tasksError.message
      : tasksError
        ? "Failed to load tasks"
        : eventsError instanceof Error
          ? eventsError.message
          : eventsError
            ? "Failed to load events"
            : null);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate calendar view from localStorage */
    setView(readStoredCalendarView());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const token = getStoredAuth()?.token;
    const status = calendarStatusQuery.data;
    if (!token || !status?.connected || status.lastSyncedAt) return;
    if (initialSyncStarted.current) return;
    initialSyncStarted.current = true;
    void syncMutation.mutateAsync().catch((err: unknown) => {
      setActionError(
        err instanceof Error ? err.message : "Google Calendar sync failed",
      );
    });
  }, [calendarStatusQuery.data, syncMutation]);

  const { scheduledEvents, unscheduledEvents } = useMemo(() => {
    const unscheduled = tasks.filter((t) => (t.events?.length ?? 0) === 0);
    return {
      scheduledEvents: events.map(toScheduledCalendarEvent),
      unscheduledEvents: unscheduled.map(toUnscheduledCalendarEvent),
    };
  }, [events, tasks]);

  const calendarKey = `${events.map((e) => e.id).join(",")}|${tasks
    .map((t) => t.id)
    .join(",")}`;

  useEffect(() => {
    const root = calendarRootRef.current;
    if (!root) return;
    const selected = root.querySelector(
      '[data-slot="segmented-control-option"][aria-selected="true"]',
    );
    const current = selected?.getAttribute("data-value");
    if (current === view) return;
    const button = root.querySelector(
      `[data-slot="segmented-control-option"][data-value="${view}"]`,
    );
    if (!(button instanceof HTMLElement)) return;
    button.click();
  }, [view, calendarKey]);

  async function handleEventCreate(payload: CalendarEventCreatePayload) {
    setActionError(null);
    try {
      await createEventMutation.mutateAsync({
        title: payload.title.trim() || "Untitled event",
        start: payload.start.toISOString(),
        end: payload.end.toISOString(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create event.";
      setActionError(message);
      throw err;
    }
  }

  async function persistMoveOrResize(
    payload: CalendarEventMovePayload | CalendarEventResizePayload,
  ) {
    const source = events.find((e) => e.id === payload.id)?.source;
    if (source === "google") {
      const message = "Google Calendar events cannot be edited in Eventra.";
      setActionError(message);
      throw new Error(message);
    }

    const taskId = unscheduledTaskId(payload.id);
    setActionError(null);
    try {
      if (taskId) {
        await scheduleTaskMutation.mutateAsync({
          taskId,
          start: payload.start.toISOString(),
          end: payload.end.toISOString(),
        });
        return;
      }
      await updateEventMutation.mutateAsync({
        id: payload.id,
        input: {
          start: payload.start.toISOString(),
          end: payload.end.toISOString(),
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update event.";
      setActionError(message);
      throw err;
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3">
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div
        ref={calendarRootRef}
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          const option = target?.closest?.("[data-value]");
          const clicked = option?.getAttribute("data-value");
          if (clicked && isCalendarViewMode(clicked)) {
            setView(clicked);
            writeStoredCalendarView(clicked);
          }
        }}
      >
      <Calendar
        key={calendarKey}
        showSwitcher={true}
        views={["week", "year", "day", "month"]}
        defaultScheduledEvents={scheduledEvents}
        defaultUnscheduledEvents={unscheduledEvents}
        onEventMove={persistMoveOrResize}
        onEventResize={persistMoveOrResize}
        onEventCreate={handleEventCreate}
        onEventClick={async () => {}}
        onDateClick={async () => {}}
        readOnly={false}
        mapFromEvent={mapCalendarEventToLibraryTask}
        previousDayButtonContent={
          <ChevronLeft className={calendarNavIconClass} aria-hidden />
        }
        nextDayButtonContent={
          <ChevronRight className={calendarNavIconClass} aria-hidden />
        }
        previousWeekButtonContent={
          <ChevronLeft className={calendarNavIconClass} aria-hidden />
        }
        nextWeekButtonContent={
          <ChevronRight className={calendarNavIconClass} aria-hidden />
        }
        previousMonthButtonContent={
          <ChevronLeft className={calendarNavIconClass} aria-hidden />
        }
        nextMonthButtonContent={
          <ChevronRight className={calendarNavIconClass} aria-hidden />
        }
        previousYearButtonContent={
          <ChevronLeft className={calendarNavIconClass} aria-hidden />
        }
        nextYearButtonContent={
          <ChevronRight className={calendarNavIconClass} aria-hidden />
        }
        viewSwitcherClassName="flex flex-wrap items-center gap-1 rounded-md border border-zinc-200/70 bg-white/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/40"
        viewSwitcherButtonClassName="rounded-md border border-transparent px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 aria-selected:border-zinc-300 aria-selected:bg-white aria-selected:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-selected:border-zinc-700 dark:aria-selected:bg-zinc-900 dark:aria-selected:text-zinc-50"
        AddEventButton={CalendarAddEventButton}
        CreateEventModal={CalendarCreateEventModal}
        EventActionButton={CalendarEventActionButton}
        EventDetailModal={CalendarEventDetailModal}
      />
      </div>
    </div>
  );
}
