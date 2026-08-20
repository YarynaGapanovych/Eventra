"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { useUserSettingsQuery } from "@/hooks/use-user-settings";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { CreateTaskModalProps } from "pull-plan-calendar";
import { X } from "lucide-react";
import { useState, type FormEvent } from "react";

function defaultEnd(start: Dayjs, durationMinutes: number): Dayjs {
  const m = durationMinutes <= 0 ? 60 : durationMinutes;
  return start.add(m, "minute");
}

export function CalendarCreateEventModal({
  isOpen,
  onClose,
  areaId,
  onSubmit,
  className,
}: CreateTaskModalProps) {
  const settingsQuery = useUserSettingsQuery();
  const durationMinutes =
    settingsQuery.data?.defaultEventDurationMinutes ??
    DEFAULT_APP_SETTINGS.defaultEventDurationMinutes;
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() => dayjs().minute(0).second(0));
  const [endDate, setEndDate] = useState(() =>
    defaultEnd(dayjs().minute(0).second(0), DEFAULT_APP_SETTINGS.defaultEventDurationMinutes),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    const s = dayjs().minute(0).second(0);
    setStartDate(s);
    setEndDate(defaultEnd(s, durationMinutes));
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
        await onSubmit({ name: title, startDate, endDate });
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
            Create event
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
            <Label htmlFor="calendar-create-event-title-input">Title</Label>
            <Input
              id="calendar-create-event-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Event title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-create-start">Start</Label>
            <Input
              id="calendar-create-start"
              type="datetime-local"
              value={startDate.format("YYYY-MM-DDTHH:mm")}
              onChange={(e) => {
                const next = dayjs(e.target.value);
                setStartDate(next);
                setEndDate((prev) =>
                  prev.isBefore(next) ? defaultEnd(next, durationMinutes) : prev,
                );
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calendar-create-end">End</Label>
            <Input
              id="calendar-create-end"
              type="datetime-local"
              value={endDate.format("YYYY-MM-DDTHH:mm")}
              onChange={(e) => setEndDate(dayjs(e.target.value))}
              required
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
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Creating…" : "Create event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
