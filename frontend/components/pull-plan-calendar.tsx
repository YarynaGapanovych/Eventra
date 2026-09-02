"use client";

import { CalendarCreateEventModal } from "@/components/calendar-create-event-modal";
import { CalendarEventDetailModal } from "@/components/calendar-event-detail-modal";
import {
  EventCreateColorProvider,
  useEventCreateDraft,
} from "@/components/event-create-color-context";
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
import { parseMasterEventId } from "@/lib/calendar-details";
import { type ApiEvent } from "@/lib/events-api";
import {
  eventContrastText,
  GOOGLE_EVENT_COLOR_FALLBACK,
  TASK_BLOCK_COLOR,
  toGoogleDisplayColor,
} from "@/lib/event-colors";
import { syncEntityReminders } from "@/lib/reminder-storage";
import { type ApiTask } from "@/lib/tasks-api";
import dayjs from "dayjs";
import { CalendarPlus, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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
} from "pull-plan-calendar";
import "pull-plan-calendar/dist/calendar.css";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

const calendarNavIconClass = "size-4 shrink-0";
const CALENDAR_VIEW_STORAGE_KEY = "eventra.calendar.view.v1";
const UNSCHEDULED_PREFIX = "task:";
const UNSCHEDULED_TITLE = "Add task to calendar";
const UNSCHEDULED_HINT =
  "Drag a task onto the calendar to schedule it, or double-click to view.";
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

const DAY_WEEK_ADD_EVENT_CSS = `
[data-slot="day-view"] [data-slot="unscheduled-list"] > [aria-label="Add event"],
[data-slot="week-view"] [data-slot="unscheduled-list"] > [aria-label="Add event"],
[data-slot="day-view"] [data-slot="unscheduled-list"] > [data-slot="calendar-add-event"],
[data-slot="week-view"] [data-slot="unscheduled-list"] > [data-slot="calendar-add-event"],
[data-slot="month-view-nav"] [data-slot="calendar-add-event"],
[data-slot="year-view-nav"] [data-slot="calendar-add-event"] {
  display: none;
}
.eventra-calendar-shell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}
.eventra-calendar-shell > [data-slot="calendar-add-event"] {
  grid-column: 1;
  grid-row: 1;
  z-index: 2;
  margin: 1.5rem 0.75rem 1.5rem 0;
}
.eventra-calendar-shell [data-slot="calendar-root"] {
  display: contents;
}
.eventra-calendar-shell [data-slot="calendar-view-switcher"] {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  justify-content: flex-end;
  margin: 1.5rem 0;
}
.eventra-calendar-shell [data-slot="calendar-content"] {
  grid-column: 1 / -1;
  grid-row: 2;
}
[data-slot="week-day-add-event"] {
  padding: 0.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #d18f60;
  line-height: 1;
}
[data-slot="week-day-add-event"]:hover {
  color: #b1724b;
}
`.trim();

function CalendarAddEventButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      data-slot="calendar-add-event"
      onClick={onClick}
      aria-label="Add event"
      className="relative z-10 shrink-0 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      <CalendarPlus className="size-4" aria-hidden />
      <span className="hidden md:inline">Add Event</span>
    </Button>
  );
}

function WeekDayAddButton({
  date,
  onClick,
}: {
  date: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-slot="week-day-add-event"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={date ? `Add event on ${date}` : "Add event"}
    >
      +
    </button>
  );
}

function sameElements(a: Element[], b: Element[]): boolean {
  return a.length === b.length && a.every((el, i) => el === b[i]);
}

function applyUnscheduledCopy(root: HTMLElement | null) {
  if (!root) return;

  const title = root.querySelector('[data-slot="unscheduled-title"]');
  if (title instanceof HTMLElement && title.textContent !== UNSCHEDULED_TITLE) {
    title.textContent = UNSCHEDULED_TITLE;
  }

  const list = root.querySelector('[data-slot="unscheduled-list"]');
  if (!(list instanceof HTMLElement)) return;

  const hasItems =
    list.querySelector('[data-slot="unscheduled-event"]') != null;
  const hint = list.querySelector('[data-slot="unscheduled-hint"]');

  if (!hasItems) {
    if (hint) hint.remove();
    return;
  }

  if (hint instanceof HTMLElement) {
    if (hint.textContent !== UNSCHEDULED_HINT) {
      hint.textContent = UNSCHEDULED_HINT;
    }
    return;
  }

  const inserted = document.createElement("p");
  inserted.setAttribute("data-slot", "unscheduled-hint");
  inserted.textContent = UNSCHEDULED_HINT;
  list.appendChild(inserted);
}

function openLibraryCreateEvent(root: HTMLElement | null) {
  const button = root?.querySelector(
    '[data-slot="unscheduled-list"] [aria-label="Add event"], [data-slot="month-view-nav"] [data-slot="calendar-add-event"], [data-slot="year-view-nav"] [data-slot="calendar-add-event"]',
  );
  if (button instanceof HTMLElement) button.click();
}

function CalendarAddEventOverlays({
  rootRef,
  view,
  calendarKey,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  view: CalendarViewMode;
  calendarKey: string;
}) {
  const [dayCells, setDayCells] = useState<Element[]>([]);

  const syncHosts = useCallback(() => {
    const root = rootRef.current;
    applyUnscheduledCopy(root);
    if (!root || view !== "week") {
      setDayCells((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const cells = [...root.querySelectorAll('[data-slot="week-day-cell"]')];
    setDayCells((prev) => (sameElements(prev, cells) ? prev : cells));
  }, [rootRef, view]);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync portals to library calendar DOM */
    syncHosts();
    const root = rootRef.current;
    if (!root) return;
    const observer = new MutationObserver(syncHosts);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [calendarKey, rootRef, syncHosts]);

  return (
    <>
      {dayCells.map((cell, index) => {
        const date = cell.getAttribute("data-date") ?? "";
        return (
          <Fragment key={date || String(index)}>
            {createPortal(
              <WeekDayAddButton
                date={date}
                onClick={() => openLibraryCreateEvent(rootRef.current)}
              />,
              cell,
            )}
          </Fragment>
        );
      })}
    </>
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

function scheduledEventColor(event: ApiEvent): string | undefined {
  const stored = toGoogleDisplayColor(event.color);
  if (stored) return stored;
  if (event.source === "google") return GOOGLE_EVENT_COLOR_FALLBACK;
  if (event.taskId) return TASK_BLOCK_COLOR;
  return undefined;
}

function toScheduledCalendarEvent(event: ApiEvent): CalendarEvent {
  const color = scheduledEventColor(event);
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
      color,
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
  const metaColor =
    typeof event.meta?.color === "string" ? event.meta.color : undefined;
  return {
    ...mapped,
    progressStatus: ProgressStatus.NOT_STARTED,
    source: event.meta?.source,
    kind: event.meta?.kind,
    taskId: event.meta?.taskId,
    color: event.color ?? metaColor,
  };
}

function unscheduledTaskId(calendarEventId: string): string | null {
  if (!calendarEventId.startsWith(UNSCHEDULED_PREFIX)) return null;
  return calendarEventId.slice(UNSCHEDULED_PREFIX.length);
}

/** Day/month/year views ignore event.color and use CSS --event-color instead. */
function eventColorCss(events: CalendarEvent[]): string {
  return events
    .map((event) => {
      const color = toGoogleDisplayColor(event.color);
      if (!color) return "";
      const text = eventContrastText(color);
      return `[data-slot="event"][data-event-id="${CSS.escape(event.id)}"]{--event-color:${color};color:${text}}`;
    })
    .filter(Boolean)
    .join("");
}

export function PullPlanCalendar() {
  return (
    <EventCreateColorProvider>
      <PullPlanCalendarView />
    </EventCreateColorProvider>
  );
}

function PullPlanCalendarView() {
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

  useEffect(() => {
    if (!error) return;
    toast.error(error, { id: "calendar-error" });
  }, [error]);

  const { scheduledEvents, unscheduledEvents } = useMemo(() => {
    const unscheduled = tasks.filter((t) => (t.events?.length ?? 0) === 0);
    return {
      scheduledEvents: events.map(toScheduledCalendarEvent),
      unscheduledEvents: unscheduled.map(toUnscheduledCalendarEvent),
    };
  }, [events, tasks]);

  const { getDraft, setDraft } = useEventCreateDraft();
  const calendarKey = `${events
    .map((e) => `${e.id}:${e.color ?? ""}`)
    .join(",")}|${tasks.map((t) => t.id).join(",")}`;
  const eventColorsCss = useMemo(
    () => eventColorCss(scheduledEvents),
    [scheduledEvents],
  );

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
      const draft = getDraft();
      const created = await createEventMutation.mutateAsync({
        title: payload.title.trim() || "Untitled event",
        start: payload.start.toISOString(),
        end: payload.end.toISOString(),
        ...draft,
        color: draft.color,
      });
      syncEntityReminders({
        entityId: created.id,
        title: created.title,
        startIso: created.start,
        minutesBefore: created.reminders.map((item) => item.minutesBefore),
      });
      setDraft({
        color: created.color ?? undefined,
        allDay: false,
        busy: true,
        visibility: "default",
        guestCanModify: false,
        guestCanInvite: true,
        guestCanSeeOthers: true,
        guests: [],
        reminders: [],
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
    const matched =
      events.find((e) => e.id === payload.id) ??
      events.find((e) => e.id === parseMasterEventId(payload.id));
    const source = matched?.source;
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
      <div
        ref={calendarRootRef}
        className="eventra-calendar-shell"
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
      {eventColorsCss ? <style>{eventColorsCss}</style> : null}
      <style>{DAY_WEEK_ADD_EVENT_CSS}</style>
      <CalendarAddEventButton
        onClick={() => openLibraryCreateEvent(calendarRootRef.current)}
      />
      <CalendarAddEventOverlays
        rootRef={calendarRootRef}
        view={view}
        calendarKey={calendarKey}
      />
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
        viewSwitcherClassName="flex w-full min-w-0 flex-nowrap items-center gap-1 rounded-md border border-zinc-200/70 bg-white/70 p-1 md:inline-flex md:w-fit dark:border-zinc-800 dark:bg-zinc-900/40"
        viewSwitcherButtonClassName="min-w-0 flex-1 whitespace-nowrap rounded-md border border-transparent px-1.5! py-1.5! text-xs! text-zinc-500 transition-colors hover:text-zinc-900 aria-selected:border-zinc-300 aria-selected:bg-white aria-selected:text-zinc-900 sm:px-3! sm:text-sm! md:flex-none dark:text-zinc-400 dark:hover:text-zinc-100 dark:aria-selected:border-zinc-700 dark:aria-selected:bg-zinc-900 dark:aria-selected:text-zinc-50"
        AddEventButton={CalendarAddEventButton}
        CreateEventModal={CalendarCreateEventModal}
        EventActionButton={CalendarEventActionButton}
        EventDetailModal={CalendarEventDetailModal}
      />
      </div>
    </div>
  );
}
