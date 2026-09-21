"use client";

import { CalendarCreateEventModal } from "@/components/calendar-create-event-modal";
import { CalendarEventDetailModal } from "@/components/calendar-event-detail-modal";
import { OverlapConfirmDialog } from "@/components/overlap-confirm-dialog";
import {
  EventCreateColorProvider,
  useEventCreateDraft,
} from "@/components/event-create-color-context";
import { Button } from "@/components/ui/button";
import {
  useCreateEventMutation,
  useEventsQuery,
  useScheduleTaskMutation,
  useUpdateEventMutation,
} from "@/hooks/use-events";
import { useTasksQuery } from "@/hooks/use-tasks";
import {
  FREE_HOSTING_WAKE_MESSAGE,
  useApiWakeNotice,
} from "@/hooks/use-api-wake-notice";
import { useUserSettingsQuery } from "@/hooks/use-user-settings";
import { parseMasterEventId } from "@/lib/calendar-details";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import {
  findOverlappingEvents,
  isOverlapConfirmCancelled,
  OverlapConfirmCancelledError,
} from "@/lib/event-overlap";
import { type ApiEvent } from "@/lib/events-api";
import {
  GOOGLE_EVENT_COLOR_FALLBACK,
  TASK_BLOCK_COLOR,
  toGoogleDisplayColor,
} from "@/lib/event-colors";
import { syncEntityReminders } from "@/lib/reminder-storage";
import { type ApiTask } from "@/lib/tasks-api";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarPlus, ChevronLeft, ChevronRight, Eye, Loader2 } from "lucide-react";
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
const MAX_EVENTS_PER_DAY = 4;
const TODAY_BUTTON_CLASS_NAME =
  "border-zinc-200 bg-white/70 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

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
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}
.eventra-calendar-shell > [data-slot="calendar-add-event"] {
  grid-column: 1;
  grid-row: 1;
  z-index: 2;
  align-self: center;
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
  align-self: center;
  margin: 1.5rem 0;
}
.eventra-calendar-shell [data-slot="calendar-content"] {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  min-height: 0;
  flex-direction: column;
}
.eventra-calendar-shell [data-slot="day-view"],
.eventra-calendar-shell [data-slot="week-view"],
.eventra-calendar-shell [data-slot="month-view"],
.eventra-calendar-shell [data-slot="year-view"] {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
}
.eventra-calendar-shell [data-slot="day-view-grid"],
.eventra-calendar-shell [data-slot="week-view-grid"],
.eventra-calendar-shell [data-slot="month-view-body"],
.eventra-calendar-shell [data-slot="year-view-months"] {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.eventra-calendar-shell [data-slot="week-view-grid"] {
  align-content: start;
}
.eventra-calendar-shell [data-slot="unscheduled-list"] {
  margin-top: auto;
  flex-shrink: 0;
}
@media (min-width: 768px) {
  .eventra-calendar-shell {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    column-gap: 0.75rem;
    row-gap: 0.75rem;
  }
  .eventra-calendar-shell > [data-slot="calendar-add-event"] {
    margin: 0;
  }
  .eventra-calendar-shell [data-slot="calendar-view-switcher"] {
    grid-column: 3;
    margin: 0;
  }
  .eventra-calendar-shell [data-slot="calendar-content"],
  .eventra-calendar-shell [data-slot="day-view"],
  .eventra-calendar-shell [data-slot="week-view"],
  .eventra-calendar-shell [data-slot="month-view"],
  .eventra-calendar-shell [data-slot="year-view"] {
    display: contents;
  }
  .eventra-calendar-shell [data-slot="day-view-nav"],
  .eventra-calendar-shell [data-slot="week-view-nav"],
  .eventra-calendar-shell [data-slot="month-view-nav"],
  .eventra-calendar-shell [data-slot="year-view-nav"] {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    min-width: 0;
    margin-top: 0;
  }
  .eventra-calendar-shell [data-slot="day-multiday"] {
    grid-column: 1 / -1;
    grid-row: 2;
    margin-top: 0;
  }
  .eventra-calendar-shell [data-slot="day-view-grid"],
  .eventra-calendar-shell [data-slot="week-view-grid"],
  .eventra-calendar-shell [data-slot="month-view-body"],
  .eventra-calendar-shell [data-slot="year-view-months"] {
    grid-column: 1 / -1;
    grid-row: 3;
    min-height: 0;
    overflow: auto;
    margin-top: 0;
  }
  .eventra-calendar-shell [data-slot="unscheduled-list"] {
    grid-column: 1 / -1;
    grid-row: 4;
    margin-top: 0;
  }
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
[data-slot="week-view"] [data-slot="week-day-cell"] {
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: start;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  min-height: 0;
  height: auto;
  padding: 0.35rem 1.25rem 0.35rem 0.5rem !important;
  border-right: none !important;
  text-align: center;
}
[data-slot="week-view"] [data-slot="week-day-cell"] > span:first-child {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
}
[data-slot="week-view"] [data-slot="week-day-cell"] > span:nth-child(2) {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.2;
}
[data-slot="week-view"] [data-slot="week-day-cell"] [data-slot="week-day-add-event"] {
  position: absolute;
  top: 0.2rem;
  right: 0.35rem;
  padding: 0.15rem;
}
[data-slot="day-view-nav"] [data-slot="today-button"],
[data-slot="week-view-nav"] [data-slot="today-button"] {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.25;
  color: #52525b;
}
.dark [data-slot="day-view-nav"] [data-slot="today-button"],
.dark [data-slot="week-view-nav"] [data-slot="today-button"] {
  border-color: #3f3f46;
  color: #a1a1aa;
}
[data-slot="month-view-body"] {
  padding: 0;
}
[data-slot="month-view-weekdays"] {
  gap: 0.5rem;
  padding: 0.35rem 0;
  margin-bottom: 0.5rem;
  border-bottom: none;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #71717a;
}
[data-slot="month-view-weeks"] {
  gap: 0.5rem;
  border: none;
  border-radius: 0;
  overflow: visible;
}
[data-slot="month-week"] {
  border: none;
  border-radius: 0;
  padding: 0;
  min-height: 7.5rem;
}
[data-slot="month-view"] [data-slot="month-week-go-week"] {
  display: none;
}
[data-slot="month-view"] [data-slot="week-days"] {
  gap: 0.5rem;
  height: 100%;
  min-height: 7.5rem;
}
[data-slot="month-view"] [data-slot="week-day-cell"] {
  position: relative;
  align-items: stretch;
  justify-content: flex-start;
  overflow: hidden;
  min-width: 0;
  padding: 0.5rem 0.5rem 0.45rem;
  background: white;
  border: 1px solid #f3f4f6;
  border-radius: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  color: #374151;
}
[data-slot="month-view"] [data-slot="week-day-spacer"] {
  min-width: 0;
  border: 1px solid #f3f4f6;
  border-radius: 1rem;
  background: #fafafa;
  box-shadow: none;
}
[data-slot="month-view"] [data-slot="week-day"] {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  padding: 0.05rem 0.15rem;
  text-align: center;
  cursor: default;
}
[data-slot="month-view"] [data-slot="week-day"] span {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.2;
}
[data-slot="month-view"] [data-slot="week-day"] button {
  position: absolute;
  top: 0.35rem;
  right: 0.4rem;
  opacity: 1;
  padding: 0.15rem;
  width: auto;
  height: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #d18f60;
  line-height: 1;
}
[data-slot="month-view"] [data-slot="week-day"] button:hover {
  color: #b1724b;
}
[data-slot="month-view"] [data-slot="week-day-events"] {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  margin-top: 0.25rem;
  gap: 0.125rem;
}
[data-slot="month-view"] [data-slot="week-day-events"] [data-slot="event"],
[data-slot="month-view"] [data-slot="day-more-item"] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 2rem;
  padding: 0.15rem 0.4rem;
  border: none !important;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.25;
  font-weight: 500;
  color: #fff !important;
  background: var(--event-color, #b1724b);
  background-image: none;
}
[data-slot="month-view"] [data-slot="week-day-events"] [data-slot="event"]:not([data-color]),
[data-slot="month-view"] [data-slot="day-more-item"]:not([data-color]) {
  background-color: #b1724b !important;
}
[data-slot="month-view"] [data-slot="week-day-events"] [data-slot="event"] > span,
[data-slot="month-view"] [data-slot="day-more-item"] > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-slot="month-view"] [data-slot="week-day-events"] [data-slot="event"] button {
  flex-shrink: 0;
  height: auto !important;
  min-height: 0 !important;
  width: auto;
  gap: 0 !important;
  padding: 0.2rem !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: inherit !important;
  cursor: pointer;
  font-size: 0 !important;
  opacity: 0.9;
}
[data-slot="month-view"] [data-slot="week-day-events"] [data-slot="event"] button svg {
  width: 0.875rem;
  height: 0.875rem;
}
[data-slot="week-view-grid"] [data-slot="event"] {
  min-height: 2rem;
  padding: 0.15rem 0.4rem !important;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.25;
  color: #fff !important;
}
[data-slot="week-view-grid"] [data-slot="event"] > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-slot="week-view-grid"] [data-slot="event"] button {
  flex-shrink: 0;
  height: auto !important;
  min-height: 0 !important;
  width: auto !important;
  gap: 0 !important;
  padding: 0.1rem !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: inherit !important;
  cursor: pointer;
  font-size: 0 !important;
  opacity: 0.9;
}
[data-slot="week-view-grid"] [data-slot="event"] button svg {
  width: 0.875rem;
  height: 0.875rem;
}
[data-slot="week-view-grid"] [data-slot="event"] [data-slot="event-time"],
[data-slot="month-view"] [data-slot="event"] [data-slot="event-time"],
[data-slot="month-view"] [data-slot="day-more-item"] [data-slot="event-time"] {
  font: inherit;
}
[data-slot="month-view"] [data-slot="day-more-wrap"] {
  width: 100%;
  min-width: 0;
}
[data-slot="month-view"] [data-slot="day-more"] {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #52525b;
  font-weight: 500;
}
[data-slot="year-view"] [data-slot="week-day-cell"] {
  align-items: stretch;
  justify-content: flex-start;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  padding: 0.05rem;
  background: transparent;
  border: none;
  border-right: 1px solid #e4e4e7;
  border-radius: 0;
  box-shadow: none;
  color: #3f3f46;
}
[data-slot="year-view"] [data-slot="week-day-cell"]:last-child {
  border-right: none;
}
[data-slot="year-view"] [data-slot="week-day-spacer"] {
  min-width: 0;
  border-right: 1px solid #e4e4e7;
  background: #fafafa;
}
[data-slot="year-view"] [data-slot="week-day-spacer"]:last-child {
  border-right: none;
}
[data-slot="year-view"] [data-slot="week-day"] {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0.05rem 0.15rem;
  text-align: left;
  cursor: default;
}
[data-slot="year-view"] [data-slot="week-day"] span {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
}
[data-slot="year-view"] [data-slot="week-day-events"] {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  margin-top: 0.1rem;
  gap: 0.1rem;
}
[data-slot="year-view"] [data-slot="week-day-events"] [data-slot="event"],
[data-slot="year-view"] [data-slot="day-more-item"] {
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 0.15rem;
  border: none !important;
  border-radius: 0.2rem;
  font-size: 0.5rem;
  line-height: 1.25;
  font-weight: 500;
  color: #18181b;
  background-image: linear-gradient(
    rgb(255 255 255 / 0.58),
    rgb(255 255 255 / 0.58)
  );
}
.dark [data-slot="month-view-weekdays"] {
  color: #a1a1aa;
}
.dark [data-slot="month-view"] [data-slot="week-day-cell"] {
  background: #18181b;
  border-color: #3f3f46;
  color: #e4e4e7;
}
.dark [data-slot="month-view"] [data-slot="week-day-spacer"] {
  background: #18181b;
  border-color: #3f3f46;
}
.dark [data-slot="month-view"] [data-slot="week-day"] button {
  color: #d18f60;
}
.dark [data-slot="month-view"] [data-slot="day-more"] {
  color: #a1a1aa;
}
.dark [data-slot="month-view"] [data-slot="week-day-events"] [data-slot="event"],
.dark [data-slot="month-view"] [data-slot="day-more-item"] {
  color: #fafafa;
  background-image: none;
}
.dark [data-slot="year-view"] [data-slot="week-day-cell"],
.dark [data-slot="year-view"] [data-slot="week-day-spacer"] {
  border-right-color: #3f3f46;
  color: #e4e4e7;
}
.dark [data-slot="year-view"] [data-slot="week-day-spacer"] {
  background: #18181b;
}
.dark [data-slot="year-view"] [data-slot="week-day-events"] [data-slot="event"],
.dark [data-slot="year-view"] [data-slot="day-more-item"] {
  color: #fafafa;
  background-image: linear-gradient(
    rgb(24 24 27 / 0.38),
    rgb(24 24 27 / 0.38)
  );
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
      size="icon-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen();
      }}
      aria-label={`View ${event.title}`}
    >
      <Eye className="size-3.5" aria-hidden />
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
      allDay: event.allDay,
    },
  };
}

function toUnscheduledCalendarEvent(task: ApiTask): CalendarEvent {
  return {
    id: `${UNSCHEDULED_PREFIX}${task.id}`,
    title: task.name,
    start: null,
    end: null,
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

function requireEventRange(
  start: Dayjs | null | undefined,
  end: Dayjs | null | undefined,
): { start: Dayjs; end: Dayjs } {
  if (start == null || end == null) {
    throw new Error("Start and end times are required.");
  }
  return { start, end };
}

function applyWorkdayStart(start: Dayjs, workdayStart: string): Dayjs {
  const match = /^(\d{1,2}):(\d{2})/.exec(workdayStart.trim());
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  return start.hour(hour).minute(minute).second(0).millisecond(0);
}

function scheduledRangeForUnscheduledDrop(
  payload: CalendarEventMovePayload | CalendarEventResizePayload,
  workdayStart: string,
  durationMinutes: number,
): { start: Dayjs; end: Dayjs } {
  if (payload.view !== "week") {
    return { start: payload.start, end: payload.end };
  }
  const hasClockTime =
    payload.start.hour() !== 0 || payload.start.minute() !== 0;
  const start = hasClockTime
    ? payload.start
    : applyWorkdayStart(payload.start, workdayStart);
  return { start, end: start.add(durationMinutes, "minute") };
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
  const [date, setDate] = useState<Dayjs>(() => dayjs());
  const [actionError, setActionError] = useState<string | null>(null);
  const [overlapPrompt, setOverlapPrompt] = useState<{
    titles: string[];
    confirmLabel: string;
  } | null>(null);
  const overlapResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const calendarRootRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useUserSettingsQuery();
  const durationMinutes =
    settingsQuery.data?.defaultEventDurationMinutes ??
    DEFAULT_APP_SETTINGS.defaultEventDurationMinutes;
  const workdayStart =
    settingsQuery.data?.workdayStart ?? DEFAULT_APP_SETTINGS.workdayStart;
  const workdayEnd =
    settingsQuery.data?.workdayEnd ?? DEFAULT_APP_SETTINGS.workdayEnd;
  const weekStartsOn =
    settingsQuery.data?.weekStartsOn ?? DEFAULT_APP_SETTINGS.weekStartsOn;
  const {
    data: tasks = [],
    error: tasksError,
    isPending: tasksPending,
  } = useTasksQuery();
  const {
    data: events = [],
    error: eventsError,
    isPending: eventsPending,
  } = useEventsQuery();
  const { isWaking, showNotice } = useApiWakeNotice();
  const calendarLoading = eventsPending || tasksPending;
  const createEventMutation = useCreateEventMutation();
  const updateEventMutation = useUpdateEventMutation();
  const scheduleTaskMutation = useScheduleTaskMutation();
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
    if (!error) return;
    if (isWaking) return;
    toast.error(error, { id: "calendar-error" });
  }, [error, isWaking]);

  const { scheduledEvents, unscheduledEvents } = useMemo(() => {
    const unscheduled = tasks.filter((t) => (t.events?.length ?? 0) === 0);
    return {
      scheduledEvents: events.map(toScheduledCalendarEvent),
      unscheduledEvents: unscheduled.map(toUnscheduledCalendarEvent),
    };
  }, [events, tasks]);

  const { getDraft, setDraft } = useEventCreateDraft();
  const unscheduledKey = unscheduledEvents.map((event) => event.id).join(",");

  function settleOverlapPrompt(ok: boolean) {
    overlapResolverRef.current?.(ok);
    overlapResolverRef.current = null;
    setOverlapPrompt(null);
  }

  function confirmOverlapIfNeeded(options: {
    start: Date;
    end: Date;
    excludeId?: string | null;
    busy?: boolean;
    confirmLabel: string;
  }): Promise<void> {
    if (options.busy === false) return Promise.resolve();
    const overlapping = findOverlappingEvents(events, options, {
      excludeId: options.excludeId,
    });
    if (overlapping.length === 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      overlapResolverRef.current = (ok) => {
        if (ok) resolve();
        else reject(new OverlapConfirmCancelledError());
      };
      setOverlapPrompt({
        titles: overlapping.map((event) => event.title),
        confirmLabel: options.confirmLabel,
      });
    });
  }

  function handleViewChange(next: CalendarViewMode) {
    setView(next);
    writeStoredCalendarView(next);
  }

  async function handleEventCreate(payload: CalendarEventCreatePayload) {
    setActionError(null);
    try {
      const { start, end } = requireEventRange(payload.start, payload.end);
      const draft = getDraft();
      await confirmOverlapIfNeeded({
        start: start.toDate(),
        end: end.toDate(),
        busy: draft.busy,
        confirmLabel: "Create anyway",
      });
      const created = await createEventMutation.mutateAsync({
        title: payload.title.trim() || "Untitled event",
        start: start.toISOString(),
        end: end.toISOString(),
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
      if (isOverlapConfirmCancelled(err)) throw err;
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

    const taskId = unscheduledTaskId(payload.id);
    const range = taskId
      ? scheduledRangeForUnscheduledDrop(
          payload,
          workdayStart,
          durationMinutes,
        )
      : { start: payload.start, end: payload.end };
    setActionError(null);
    try {
      await confirmOverlapIfNeeded({
        start: range.start.toDate(),
        end: range.end.toDate(),
        excludeId: taskId ? null : payload.id,
        busy: matched?.busy ?? true,
        confirmLabel: taskId ? "Schedule anyway" : "Save anyway",
      });
      if (taskId) {
        await scheduleTaskMutation.mutateAsync({
          taskId,
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        });
        return;
      }
      await updateEventMutation.mutateAsync({
        id: payload.id,
        input: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      });
    } catch (err) {
      if (isOverlapConfirmCancelled(err)) throw err;
      const message =
        err instanceof Error ? err.message : "Could not update event.";
      setActionError(message);
      throw err;
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col gap-3">
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={calendarRootRef} className="eventra-calendar-shell min-h-0 flex-1">
      <style>{DAY_WEEK_ADD_EVENT_CSS}</style>
      <CalendarAddEventButton
        onClick={() => openLibraryCreateEvent(calendarRootRef.current)}
      />
      <CalendarAddEventOverlays
        rootRef={calendarRootRef}
        view={view}
        calendarKey={unscheduledKey}
      />
      {calendarLoading ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/75 px-6 text-center backdrop-blur-[2px] dark:bg-zinc-950/70"
          role="status"
        >
          <Loader2
            className="size-6 animate-spin text-teal-700 dark:text-teal-400"
            aria-hidden
          />
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Loading calendar…
          </p>
          {showNotice ? (
            <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              {FREE_HOSTING_WAKE_MESSAGE}
            </p>
          ) : null}
        </div>
      ) : (
      <Calendar
        key={unscheduledKey}
        showSwitcher={true}
        views={["week", "year", "day", "month"]}
        view={view}
        onViewChange={handleViewChange}
        date={date}
        onDateChange={setDate}
        events={scheduledEvents}
        defaultUnscheduledEvents={unscheduledEvents}
        defaultDurationMinutes={durationMinutes}
        workdayStart={workdayStart}
        workdayEnd={workdayEnd}
        showFullDay={true}
        weekStartsOn={weekStartsOn}
        maxEventsPerDay={MAX_EVENTS_PER_DAY}
        todayButtonContent="Today"
        todayButtonClassName={TODAY_BUTTON_CLASS_NAME}
        labels={{
          unscheduledTitle: UNSCHEDULED_TITLE,
          unscheduledHint: UNSCHEDULED_HINT,
        }}
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
      )}
      </div>
      <OverlapConfirmDialog
        open={overlapPrompt !== null}
        titles={overlapPrompt?.titles ?? []}
        confirmLabel={overlapPrompt?.confirmLabel ?? "Create anyway"}
        onCancel={() => settleOverlapPrompt(false)}
        onConfirm={() => settleOverlapPrompt(true)}
      />
      </div>
    </div>
  );
}
