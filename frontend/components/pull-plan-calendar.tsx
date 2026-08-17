"use client";

import { CalendarCreateEventModal } from "@/components/calendar-create-event-modal";
import { Button } from "@/components/ui/button";
import { loadAppSettings } from "@/lib/app-settings";
import { getStoredAuth } from "@/lib/auth-api";
import {
  fetchGoogleCalendarStatus,
  syncGoogleCalendar,
} from "@/lib/google-calendar-sync";
import { createTask, fetchTasks, type ApiTask } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { CalendarPlus, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import {
  CalendarContainer,
  mapEventToTask,
  mapTaskToEvent,
  ProgressStatus,
  type Area,
  type CalendarEvent,
  type Task,
  type TaskModalProps,
} from "pull-plan-calendar";
import "pull-plan-calendar/dist/calendar.css";
import { useCallback, useEffect, useMemo, useState } from "react";

const calendarNavIconClass = "size-4 shrink-0";
const GOOGLE_EVENT_COLOR = "#4285F4";

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

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-task-detail-title"
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
            id="calendar-task-detail-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Task details
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
        {task.source === "google" ? (
          <p className="mt-1 text-xs font-medium text-[#4285F4]">
            Google Calendar
          </p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Start: {dayjs(task.startDate).format("MMM D, YYYY")}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          End: {dayjs(task.endDate).format("MMM D, YYYY")}
        </p>
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

const MOCK_AREAS: Area[] = [
  { id: "area-1", name: "Production" },
  { id: "area-2", name: "Assembly" },
];

function apiTaskToLibraryTask(t: ApiTask): Task {
  const status = Object.values(ProgressStatus).includes(
    t.progressStatus as ProgressStatus,
  )
    ? (t.progressStatus as ProgressStatus)
    : ProgressStatus.NOT_STARTED;

  return {
    id: t.id,
    name: t.name,
    startDate: dayjs(t.startDate),
    endDate: dayjs(t.endDate),
    employees: t.employees.map((e) => ({
      id: e.id,
      name: e.name ?? undefined,
    })),
    progressStatus: status,
    source: t.source,
  };
}

function toCalendarEvent(task: ApiTask): CalendarEvent {
  const event = mapTaskToEvent(apiTaskToLibraryTask(task));
  if (task.source === "google") {
    return { ...event, color: GOOGLE_EVENT_COLOR };
  }
  return event;
}

export function PullPlanCalendar() {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTasks();
      setTasks(data);
      setLastSynced(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const token = getStoredAuth()?.token;
    if (!token) return;

    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchGoogleCalendarStatus(token);
        if (cancelled || !status.connected || status.lastSyncedAt) return;
        await syncGoogleCalendar(token);
        if (!cancelled) await load();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Google Calendar sync failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const { scheduledEvents, unscheduledEvents } = useMemo(() => {
    const scheduled = tasks.filter((t) => t.scheduled);
    const unscheduled = tasks.filter((t) => !t.scheduled);
    return {
      scheduledEvents: scheduled.map(toCalendarEvent),
      unscheduledEvents: unscheduled.map(toCalendarEvent),
    };
  }, [tasks]);

  const calendarKey = tasks.map((t) => t.id).join(",");

  async function handleCreateDemo() {
    setPending(true);
    setError(null);
    try {
      const start = dayjs().add(1, "hour").startOf("hour");
      const mins = loadAppSettings().defaultEventDurationMinutes;
      await createTask({
        name: `Demo task ${start.format("HH:mm")}`,
        startDate: start.toISOString(),
        endDate: start.add(Math.max(15, mins), "minute").toISOString(),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setPending(false);
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

      <CalendarContainer
        key={calendarKey}
        showSwitcher={true}
        showTabs={false}
        views={["week", "year", "day", "month"]}
        areas={MOCK_AREAS}
        defaultScheduledEvents={scheduledEvents}
        defaultUnscheduledEvents={unscheduledEvents}
        onEventMove={async () => {}}
        onEventResize={async () => {}}
        onEventCreate={async () => {}}
        onEventClick={async () => {}}
        onDateClick={async () => {}}
        readOnly={false}
        mapFromEvent={mapEventToTask}
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
  );
}
