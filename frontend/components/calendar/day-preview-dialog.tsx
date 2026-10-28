"use client";

import { Button } from "@/components/ui/button";
import { DEFAULT_EVENTRA_EVENT_COLOR } from "@/lib/event-colors";
import dayjs, { type Dayjs } from "dayjs";
import { Plus, X } from "lucide-react";
import type { CalendarEvent } from "pull-plan-calendar";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const HOUR_HEIGHT = 56;
const MIN_EVENT_HEIGHT = 22;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

type TimedPlacement = {
  event: CalendarEvent;
  top: number;
  height: number;
  column: number;
  columns: number;
};

function eventColor(event: CalendarEvent): string {
  return event.color ?? DEFAULT_EVENTRA_EVENT_COLOR;
}

function isAllDayOn(event: CalendarEvent, dayStart: Dayjs, dayEnd: Dayjs) {
  if (event.meta?.allDay === true) return true;
  const start = dayjs(event.start);
  const end = dayjs(event.end);
  return !start.isAfter(dayStart) && !end.isBefore(dayEnd);
}

/** Positions timed events on a 24h grid, splitting overlaps into columns. */
function placeTimedEvents(events: CalendarEvent[], dayStart: Dayjs) {
  const dayEnd = dayStart.add(1, "day");
  const items = events
    .map((event) => {
      const start = dayjs(event.start);
      const end = dayjs(event.end);
      const startMin = Math.max(0, start.diff(dayStart, "minute"));
      const endMin = Math.min(24 * 60, end.diff(dayStart, "minute"));
      return { event, startMin, endMin: Math.max(endMin, startMin + 15) };
    })
    .filter(({ event }) => dayjs(event.start).isBefore(dayEnd))
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const placements: TimedPlacement[] = [];
  let group: { item: (typeof items)[number]; column: number }[] = [];
  let groupEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...group.map((g) => g.column + 1));
    for (const { item, column } of group) {
      placements.push({
        event: item.event,
        top: (item.startMin / 60) * HOUR_HEIGHT,
        height: Math.max(
          MIN_EVENT_HEIGHT,
          ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT,
        ),
        column,
        columns,
      });
    }
    group = [];
    groupEnd = -1;
  };

  for (const item of items) {
    if (group.length > 0 && item.startMin >= groupEnd) flush();
    const columnEnds: number[] = [];
    for (const g of group) {
      columnEnds[g.column] = Math.max(columnEnds[g.column] ?? 0, g.item.endMin);
    }
    let column = columnEnds.findIndex((end) => end <= item.startMin);
    if (column === -1) column = columnEnds.length;
    group.push({ item, column });
    groupEnd = Math.max(groupEnd, item.endMin);
  }
  if (group.length > 0) flush();
  return placements;
}

export function DayPreviewDialog({
  date,
  events,
  scrollToHour,
  onClose,
  onEventOpen,
  onAdd,
}: {
  date: Dayjs | null;
  events: CalendarEvent[];
  scrollToHour: number;
  onClose: () => void;
  onEventOpen: (event: CalendarEvent) => void;
  onAdd: (date: Dayjs) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayStart = date?.startOf("day") ?? null;

  const { allDay, timed } = useMemo(() => {
    if (!dayStart) return { allDay: [], timed: [] };
    const dayEnd = dayStart.add(1, "day");
    const allDayEvents: CalendarEvent[] = [];
    const timedEvents: CalendarEvent[] = [];
    for (const event of events) {
      if (isAllDayOn(event, dayStart, dayEnd)) allDayEvents.push(event);
      else timedEvents.push(event);
    }
    return {
      allDay: allDayEvents,
      timed: placeTimedEvents(timedEvents, dayStart),
    };
    // dayStart is derived from date; keying on the date string avoids churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, date?.format("YYYY-MM-DD")]);

  const dateKey = date?.format("YYYY-MM-DD");
  useEffect(() => {
    if (!dateKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dateKey, onClose]);

  const firstTop = timed[0]?.top;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !dateKey) return;
    const target = firstTop ?? scrollToHour * HOUR_HEIGHT;
    el.scrollTop = Math.max(0, target - HOUR_HEIGHT / 2);
    // Scroll only when a day opens, not on every event refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  if (!date || typeof document === "undefined") return null;

  const shortLabel = date.format("MMM D");

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={date.format("dddd, MMMM D")}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-zinc-950/25 backdrop-blur-[2px] dark:bg-black/50"
      />
      <div className="relative z-10 flex h-[80vh] max-h-[720px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3 bg-zinc-50 px-6 pt-6 pb-4 dark:bg-zinc-900/60">
          <h2 className="flex items-baseline gap-2 text-zinc-900 dark:text-zinc-50">
            <span className="text-3xl font-semibold leading-none">
              {date.format("D")}
            </span>
            <span className="text-xl font-medium">{date.format("dddd")}</span>
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="border-b border-zinc-100 px-6 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {shortLabel}
        </div>

        {allDay.length > 0 ? (
          <div className="flex flex-col gap-1 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
            {allDay.map((event) => (
              <DayEventBlock
                key={event.id}
                event={event}
                onOpen={() => onEventOpen(event)}
                className="relative px-3 py-1"
              />
            ))}
          </div>
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pb-24">
          <div
            className="relative mr-4 ml-12"
            style={{ height: 24 * HOUR_HEIGHT }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-800"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 -left-10 w-8 text-right text-xs text-zinc-400 dark:text-zinc-500">
                  {hour}
                </span>
              </div>
            ))}
            {timed.map(({ event, top, height, column, columns }) => (
              <DayEventBlock
                key={event.id}
                event={event}
                onOpen={() => onEventOpen(event)}
                className="absolute px-2.5 py-1.5"
                style={{
                  top,
                  height,
                  left: `calc(${(column / columns) * 100}% + 2px)`,
                  width: `calc(${100 / columns}% - 4px)`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-6">
          <button
            type="button"
            onClick={() => onAdd(date)}
            className="pointer-events-auto flex w-full max-w-xs items-center justify-between rounded-full bg-zinc-100 py-3 pr-4 pl-6 text-left text-zinc-500 shadow-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            <span>Add on {shortLabel}</span>
            <Plus className="size-5 text-zinc-800 dark:text-zinc-100" aria-hidden />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DayEventBlock({
  event,
  onOpen,
  className,
  style,
}: {
  event: CalendarEvent;
  onOpen: () => void;
  className: string;
  style?: CSSProperties;
}) {
  const color = eventColor(event);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} overflow-hidden rounded-md border-l-4 text-left text-sm text-zinc-900 transition-[filter] hover:brightness-95 dark:text-zinc-50`}
      style={{
        ...style,
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      <span className="line-clamp-2 font-medium">{event.title}</span>
    </button>
  );
}
