"use client";

import {
  EventDetailsForm,
  eventToFormValues,
  formValuesToPayload,
  taskToFormValues,
  type EventDetailsFormValues,
} from "@/components/event-details-form";
import { Button } from "@/components/ui/button";
import { useEventsQuery, useUpdateEventMutation } from "@/hooks/use-events";
import { useTasksQuery, useUpdateTaskMutation } from "@/hooks/use-tasks";
import { useUserSettingsQuery } from "@/hooks/use-user-settings";
import { DEFAULT_APP_SETTINGS, getDefaultTimezone } from "@/lib/app-settings";
import { parseMasterEventId } from "@/lib/calendar-details";
import { syncEntityReminders } from "@/lib/reminder-storage";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TaskModalProps } from "pull-plan-calendar";

const UNSCHEDULED_PREFIX = "task:";

function unscheduledTaskId(calendarEventId: string): string | null {
  if (!calendarEventId.startsWith(UNSCHEDULED_PREFIX)) return null;
  return calendarEventId.slice(UNSCHEDULED_PREFIX.length);
}

export function CalendarEventDetailModal({
  task,
  isOpen,
  onClose,
  className,
}: TaskModalProps) {
  const settingsQuery = useUserSettingsQuery();
  const timezone = settingsQuery.data?.timezone ?? getDefaultTimezone();
  const durationMinutes =
    settingsQuery.data?.defaultEventDurationMinutes ??
    DEFAULT_APP_SETTINGS.defaultEventDurationMinutes;
  const { data: events = [] } = useEventsQuery();
  const { data: tasks = [] } = useTasksQuery();
  const updateEventMutation = useUpdateEventMutation();
  const updateTaskMutation = useUpdateTaskMutation();

  const source = typeof task?.source === "string" ? task.source : null;
  const kind = typeof task?.kind === "string" ? task.kind : null;
  const eventId = typeof task?.id === "string" ? task.id : null;
  const masterId = eventId ? parseMasterEventId(eventId) : null;
  const taskIdFromMeta =
    typeof task?.taskId === "string" ? task.taskId : null;
  const unscheduledId = eventId ? unscheduledTaskId(eventId) : null;

  const apiEvent = useMemo(
    () =>
      events.find((event) => event.id === eventId) ??
      events.find((event) => event.id === masterId) ??
      null,
    [events, eventId, masterId],
  );
  const apiTask = useMemo(() => {
    const id = unscheduledId ?? taskIdFromMeta ?? apiEvent?.taskId;
    if (!id) return null;
    return tasks.find((item) => item.id === id) ?? null;
  }, [unscheduledId, taskIdFromMeta, apiEvent?.taskId, tasks]);

  const isUnscheduled = kind === "unscheduled-task" || Boolean(unscheduledId);
  const isGoogle = source === "google" || apiEvent?.source === "google";
  const showTaskFields = isUnscheduled || Boolean(apiTask);
  const readOnly = isGoogle && !isUnscheduled;

  const [values, setValues] = useState<EventDetailsFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setValues(null);
      setError(null);
      return;
    }
    if (isUnscheduled && apiTask) {
      setValues(taskToFormValues(apiTask, timezone, durationMinutes));
      return;
    }
    if (apiEvent) {
      const next = eventToFormValues(apiEvent, timezone);
      if (apiTask) {
        setValues({
          ...next,
          status: apiTask.status,
          priority: apiTask.priority,
          deadlineLocal: apiTask.deadline
            ? apiTask.deadline.slice(0, 16)
            : "",
        });
        return;
      }
      setValues(next);
      return;
    }
    if (task) {
      setValues(
        eventToFormValues(
          {
            id: eventId ?? "unknown",
            title: task.name,
            start: dayjs(task.startDate).toISOString(),
            end: dayjs(task.endDate).toISOString(),
            source: source === "google" ? "google" : "eventra",
            googleEventId: null,
            color: typeof task.color === "string" ? task.color : null,
            taskId: taskIdFromMeta,
            location: null,
            description: null,
            allDay: false,
            timezone,
            recurrence: null,
            busy: true,
            visibility: "default",
            conferenceUrl: null,
            guestCanModify: false,
            guestCanInvite: true,
            guestCanSeeOthers: true,
            guests: [],
            reminders: [],
          },
          timezone,
        ),
      );
    }
  }, [
    isOpen,
    isUnscheduled,
    apiTask,
    apiEvent,
    timezone,
    durationMinutes,
    task,
    eventId,
    source,
    taskIdFromMeta,
  ]);

  async function handleSubmit(next: EventDetailsFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = formValuesToPayload(next, {
        timesOptional: isUnscheduled,
      });
      if (isUnscheduled && apiTask) {
        const saved = await updateTaskMutation.mutateAsync({
          id: apiTask.id,
          input: {
            name: payload.title,
            status: payload.status,
            priority: payload.priority,
            deadline: payload.deadline,
            start: payload.start,
            end: payload.end,
            ...payload.calendar,
          },
        });
        syncEntityReminders({
          entityId: saved.id,
          title: saved.name,
          startIso: payload.start ?? saved.start,
          minutesBefore: payload.calendar.reminders?.map((r) => r.minutesBefore) ?? [],
        });
      } else if (masterId) {
        const saved = await updateEventMutation.mutateAsync({
          id: eventId ?? masterId,
          input: {
            title: payload.title,
            start: payload.start ?? undefined,
            end: payload.end ?? undefined,
            ...payload.calendar,
          },
        });
        syncEntityReminders({
          entityId: parseMasterEventId(saved.id),
          title: saved.title,
          startIso: payload.start ?? saved.start,
          minutesBefore: payload.calendar.reminders?.map((r) => r.minutesBefore) ?? [],
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen || !values) return null;

  const heading = isUnscheduled
    ? "Unscheduled task"
    : isGoogle
      ? "Event details"
      : "Edit event";

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
      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="calendar-event-detail-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {heading}
            </h2>
            {isGoogle ? (
              <p className="mt-1 text-xs font-medium text-zinc-500">
                Google Calendar
              </p>
            ) : kind === "task-block" ? (
              <p className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-400">
                Scheduled task
              </p>
            ) : null}
          </div>
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
        <div className="mt-4">
          <EventDetailsForm
            values={values}
            onChange={setValues}
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel="Save"
            readOnly={readOnly}
            showTaskFields={showTaskFields}
            timesOptional={isUnscheduled}
            submitting={submitting}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
