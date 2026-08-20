"use client";

import { EventDetailsForm, defaultFormValues, formValuesToPayload, type EventDetailsFormValues } from "@/components/event-details-form";
import { useEventCreateDraft } from "@/components/event-create-color-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { DEFAULT_EVENTRA_EVENT_COLOR } from "@/lib/event-colors";
import { useUserSettingsQuery } from "@/hooks/use-user-settings";
import dayjs from "dayjs";
import type { CreateTaskModalProps } from "pull-plan-calendar";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

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
  const timezone =
    settingsQuery.data?.timezone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");
  const { setDraft } = useEventCreateDraft();
  const [values, setValues] = useState<EventDetailsFormValues>(() =>
    defaultFormValues(timezone, durationMinutes),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const next = {
      ...defaultFormValues(timezone, durationMinutes),
      color: DEFAULT_EVENTRA_EVENT_COLOR,
    };
    setValues(next);
    setDraft({
      ...formValuesToPayload(next, { timesOptional: false }).calendar,
      color: next.color,
    });
  }, [isOpen, timezone, durationMinutes, setDraft]);

  function handleChange(next: EventDetailsFormValues) {
    setValues(next);
    setDraft(formValuesToPayload(next, { timesOptional: false }).calendar);
  }

  const handleCancel = () => {
    onClose();
  };

  const handleSubmit = async (next: EventDetailsFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = formValuesToPayload(next, { timesOptional: false });
      setDraft(payload.calendar);
      if (onSubmit && payload.start && payload.end) {
        await onSubmit({
          name: payload.title,
          startDate: dayjs(payload.start),
          endDate: dayjs(payload.end),
        });
      }
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
      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
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
        {areaId ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Area ID: {areaId}
          </p>
        ) : null}
        <div className="mt-4">
          <EventDetailsForm
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel="Save"
            submitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
