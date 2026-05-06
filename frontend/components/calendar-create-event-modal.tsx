"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { loadAppSettings } from "@/lib/app-settings";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { CreateTaskModalProps } from "pull-plan-calendar";
import { X } from "lucide-react";
import { useState, type FormEvent } from "react";

function defaultCalendarEndDay(start: Dayjs): Dayjs {
  const mins = loadAppSettings().defaultEventDurationMinutes;
  const m = mins <= 0 ? 60 : mins;
  const inclusiveSlots = Math.max(1, Math.ceil(m / (24 * 60)));
  return start.startOf("day").add(Math.max(0, inclusiveSlots - 1), "day");
}

export function CalendarCreateEventModal({
  isOpen,
  onClose,
  areaId,
  onSubmit,
  className,
}: CreateTaskModalProps) {
  const [taskName, setTaskName] = useState("");
  const [startDate, setStartDate] = useState(() => dayjs());
  const [endDate, setEndDate] = useState(() =>
    defaultCalendarEndDay(dayjs()),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTaskName("");
    const s = dayjs();
    setStartDate(s);
    setEndDate(defaultCalendarEndDay(s));
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({ name: taskName, startDate, endDate });
      } else {
        await new Promise((r) => setTimeout(r, 500));
      }
      reset();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-create-event-title"
    >
      <Button
        type="button"
        variant="ghost"
        aria-label="Close"
        onClick={handleCancel}
        className="absolute inset-0 z-0 h-full min-h-0 w-full cursor-default rounded-none border-0 bg-zinc-950/40 p-0 shadow-none ring-0 backdrop-blur-sm hover:bg-zinc-950/45 focus-visible:ring-0 dark:bg-black/50 dark:hover:bg-black/55"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="calendar-create-event-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Create new task
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleCancel}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="calendar-create-task-name">Task name</Label>
            <Input
              id="calendar-create-task-name"
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              required
              placeholder="Enter task name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-create-start">Start date</Label>
            <Input
              id="calendar-create-start"
              type="date"
              value={startDate.format("YYYY-MM-DD")}
              onChange={(e) => {
                const next = dayjs(e.target.value);
                setStartDate(next);
                setEndDate((prev) =>
                  prev.isBefore(next.startOf("day"))
                    ? defaultCalendarEndDay(next)
                    : prev,
                );
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-create-end">End date</Label>
            <Input
              id="calendar-create-end"
              type="date"
              value={endDate.format("YYYY-MM-DD")}
              onChange={(e) => setEndDate(dayjs(e.target.value))}
              required
              min={startDate.format("YYYY-MM-DD")}
            />
          </div>
          {areaId ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Area ID: {areaId}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !taskName.trim()}
            >
              {isSubmitting ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
