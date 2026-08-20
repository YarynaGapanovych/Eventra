"use client";

import {
  EventDetailsForm,
  defaultFormValues,
  formValuesToPayload,
  taskToFormValues,
  type EventDetailsFormValues,
} from "@/components/event-details-form";
import { Button } from "@/components/ui/button";
import { useUserSettingsQuery } from "@/hooks/use-user-settings";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
} from "@/hooks/use-tasks";
import { DEFAULT_APP_SETTINGS, getDefaultTimezone } from "@/lib/app-settings";
import { EMPTY_CALENDAR_DETAILS } from "@/lib/calendar-details";
import { DEFAULT_EVENTRA_EVENT_COLOR } from "@/lib/event-colors";
import { syncEntityReminders } from "@/lib/reminder-storage";
import {
  isMockTaskId,
  MOCK_TASK_ID_PREFIX,
  type ApiTask,
  type TaskBoardStatus,
} from "@/lib/tasks-api";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

function progressLabelForBoardStatus(s: TaskBoardStatus): string {
  if (s === "done") return "completed";
  if (s === "in_progress") return "in_progress";
  return "not_started";
}

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  open: boolean;
  task: ApiTask | null;
  onClose: () => void;
  onSaved: () => void;
  mockPersist?: boolean;
  onMockPersist?: (task: ApiTask) => void;
};

export function TaskEditDialog({
  mode,
  open,
  task,
  onClose,
  onSaved,
  mockPersist = false,
  onMockPersist,
}: Props) {
  const settingsQuery = useUserSettingsQuery();
  const timezone = settingsQuery.data?.timezone ?? getDefaultTimezone();
  const durationMinutes =
    settingsQuery.data?.defaultEventDurationMinutes ??
    DEFAULT_APP_SETTINGS.defaultEventDurationMinutes;
  const [values, setValues] = useState<EventDetailsFormValues>(() =>
    defaultFormValues(timezone, durationMinutes),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createTaskMutation = useCreateTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && task) {
      setValues(taskToFormValues(task, timezone, durationMinutes));
    } else {
      setValues({
        ...defaultFormValues(timezone, durationMinutes),
        color: DEFAULT_EVENTRA_EVENT_COLOR,
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
      });
    }
  }, [open, mode, task, timezone, durationMinutes]);

  if (!open) return null;

  const title = mode === "create" ? "New task" : "Edit task";
  const blockCount = task?.events.length ?? 0;

  async function submit(next: EventDetailsFormValues) {
    setSubmitting(true);
    setError(null);

    try {
      const payload = formValuesToPayload(next, { timesOptional: true });
      if (!payload.title) {
        setError("Title is required.");
        return;
      }

      if (mockPersist && mode === "create") {
        const idSuffix =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Date.now().toString(36);
        const fresh: ApiTask = {
          id: `${MOCK_TASK_ID_PREFIX}${idSuffix}`,
          name: payload.title,
          progressStatus: progressLabelForBoardStatus(payload.status),
          status: payload.status,
          priority: payload.priority,
          deadline: payload.deadline,
          areaId: null,
          start: payload.start,
          end: payload.end,
          color: payload.calendar.color ?? DEFAULT_EVENTRA_EVENT_COLOR,
          employees: [],
          events: [],
          ...EMPTY_CALENDAR_DETAILS,
          ...payload.calendar,
          location: payload.calendar.location ?? null,
          description: payload.calendar.description ?? null,
          allDay: payload.calendar.allDay ?? false,
          timezone: payload.calendar.timezone ?? null,
          recurrence: payload.calendar.recurrence ?? null,
          busy: payload.calendar.busy ?? true,
          visibility: payload.calendar.visibility ?? "default",
          conferenceUrl: payload.calendar.conferenceUrl ?? null,
          guestCanModify: payload.calendar.guestCanModify ?? false,
          guestCanInvite: payload.calendar.guestCanInvite ?? true,
          guestCanSeeOthers: payload.calendar.guestCanSeeOthers ?? true,
          guests: (payload.calendar.guests ?? []).map((guest, index) => ({
            id: `guest-${index}`,
            email: guest.email,
            name: guest.name ?? null,
            response: "needsAction" as const,
          })),
          reminders: (payload.calendar.reminders ?? []).map((reminder, index) => ({
            id: `reminder-${index}`,
            minutesBefore: reminder.minutesBefore,
          })),
        };
        onMockPersist?.(fresh);
        syncEntityReminders({
          entityId: fresh.id,
          title: fresh.name,
          startIso: payload.start,
          minutesBefore: fresh.reminders.map((item) => item.minutesBefore),
        });
        onClose();
        onSaved();
        return;
      }

      if (mockPersist && mode === "edit" && task && isMockTaskId(task.id)) {
        const updated: ApiTask = {
          ...task,
          name: payload.title,
          status: payload.status,
          priority: payload.priority,
          progressStatus: progressLabelForBoardStatus(payload.status),
          deadline: payload.deadline,
          start: payload.start,
          end: payload.end,
          color: payload.calendar.color ?? task.color,
          ...payload.calendar,
          location: payload.calendar.location ?? null,
          description: payload.calendar.description ?? null,
          allDay: payload.calendar.allDay ?? false,
          timezone: payload.calendar.timezone ?? null,
          recurrence: payload.calendar.recurrence ?? null,
          busy: payload.calendar.busy ?? true,
          visibility: payload.calendar.visibility ?? "default",
          conferenceUrl: payload.calendar.conferenceUrl ?? null,
          guestCanModify: payload.calendar.guestCanModify ?? false,
          guestCanInvite: payload.calendar.guestCanInvite ?? true,
          guestCanSeeOthers: payload.calendar.guestCanSeeOthers ?? true,
          guests: (payload.calendar.guests ?? []).map((guest, index) => ({
            id: task.guests[index]?.id ?? `guest-${index}`,
            email: guest.email,
            name: guest.name ?? null,
            response: task.guests[index]?.response ?? "needsAction",
          })),
          reminders: (payload.calendar.reminders ?? []).map((reminder, index) => ({
            id: task.reminders[index]?.id ?? `reminder-${index}`,
            minutesBefore: reminder.minutesBefore,
          })),
        };
        onMockPersist?.(updated);
        syncEntityReminders({
          entityId: updated.id,
          title: updated.name,
          startIso: payload.start,
          minutesBefore: updated.reminders.map((item) => item.minutesBefore),
        });
        onClose();
        onSaved();
        return;
      }

      if (mode === "create") {
        const saved = await createTaskMutation.mutateAsync({
          name: payload.title,
          status: payload.status,
          priority: payload.priority,
          ...(payload.deadline ? { deadline: payload.deadline } : {}),
          ...(payload.start ? { start: payload.start } : {}),
          ...(payload.end ? { end: payload.end } : {}),
          ...payload.calendar,
        });
        syncEntityReminders({
          entityId: saved.id,
          title: saved.name,
          startIso: payload.start ?? saved.start,
          minutesBefore: saved.reminders.map((item) => item.minutesBefore),
        });
      } else if (task) {
        const saved = await updateTaskMutation.mutateAsync({
          id: task.id,
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
          minutesBefore: saved.reminders.map((item) => item.minutesBefore),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-edit-title"
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
          <h2
            id="task-edit-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {mode === "edit" && blockCount > 0 ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {blockCount} calendar block{blockCount === 1 ? "" : "s"}. Marking
            done frees future slots.
          </p>
        ) : null}

        <div className="mt-4">
          <EventDetailsForm
            values={values}
            onChange={setValues}
            onSubmit={submit}
            onCancel={onClose}
            submitLabel={mode === "create" ? "Create" : "Save"}
            showTaskFields
            timesOptional
            submitting={submitting}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
