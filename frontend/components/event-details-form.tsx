"use client";

import { EventColorPicker } from "@/components/event-color-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatTimeZoneLabel,
  isoToZonedParts,
  listTimeZones,
  recurrenceOptions,
  recurrenceSelectValue,
  REMINDER_PRESETS,
  VISIBILITY_OPTIONS,
  withCalendarDefaults,
  zonedWallTimeToIso,
  type CalendarDetailsInput,
  type EventVisibility,
} from "@/lib/calendar-details";
import { DEFAULT_EVENTRA_EVENT_COLOR } from "@/lib/event-colors";
import type { ApiEvent } from "@/lib/events-api";
import {
  TASK_BOARD_STATUSES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ApiTask,
  type TaskBoardStatus,
  type TaskPriority,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  Bell,
  Briefcase,
  Calendar,
  MapPin,
  Palette,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";

const selectClass = cn(
  "flex h-8 w-full rounded-lg border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-sm shadow-none outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:border-zinc-700 dark:bg-zinc-900",
);

const pillClass = cn(
  "h-8 rounded-lg border-0 bg-zinc-100 px-2.5 text-sm shadow-none outline-none",
  "focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:bg-zinc-900",
);

export type EventDetailsFormValues = {
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  timezone: string;
  recurrence: string;
  location: string;
  description: string;
  conferenceUrl: string;
  color: string;
  busy: boolean;
  visibility: EventVisibility;
  guestCanModify: boolean;
  guestCanInvite: boolean;
  guestCanSeeOthers: boolean;
  guests: { email: string; name?: string }[];
  reminders: { minutesBefore: number }[];
  status: TaskBoardStatus;
  priority: TaskPriority;
  deadlineLocal: string;
};

export type EventDetailsPayload = {
  title: string;
  start: string | null;
  end: string | null;
  calendar: CalendarDetailsInput;
  status: TaskBoardStatus;
  priority: TaskPriority;
  deadline: string | null;
};

function padTime(value: string, fallback: string) {
  return value && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback;
}

function defaultFormValues(
  fallbackTz: string,
  durationMinutes: number,
): EventDetailsFormValues {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(0);
  const end = new Date(now.getTime() + Math.max(durationMinutes, 15) * 60_000);
  const startParts = isoToZonedParts(now.toISOString(), fallbackTz);
  const endParts = isoToZonedParts(end.toISOString(), fallbackTz);
  return {
    title: "",
    startDate: startParts.date,
    startTime: startParts.time,
    endDate: endParts.date,
    endTime: endParts.time,
    allDay: false,
    timezone: fallbackTz,
    recurrence: "",
    location: "",
    description: "",
    conferenceUrl: "",
    color: DEFAULT_EVENTRA_EVENT_COLOR,
    busy: true,
    visibility: "default",
    guestCanModify: false,
    guestCanInvite: true,
    guestCanSeeOthers: true,
    guests: [],
    reminders: [],
    status: "todo",
    priority: "medium",
    deadlineLocal: "",
  };
}

export function eventToFormValues(
  event: ApiEvent,
  fallbackTz: string,
): EventDetailsFormValues {
  const tz = event.timezone || fallbackTz;
  const start = isoToZonedParts(event.start, tz);
  const end = isoToZonedParts(event.end, tz);
  return {
    ...defaultFormValues(tz, 60),
    title: event.title,
    startDate: start.date,
    startTime: padTime(start.time, "09:00"),
    endDate: end.date,
    endTime: padTime(end.time, "10:00"),
    allDay: event.allDay,
    timezone: tz,
    recurrence: recurrenceSelectValue(event.recurrence, new Date(event.start)),
    location: event.location ?? "",
    description: event.description ?? "",
    conferenceUrl: event.conferenceUrl ?? "",
    color: event.color ?? DEFAULT_EVENTRA_EVENT_COLOR,
    busy: event.busy,
    visibility: event.visibility,
    guestCanModify: event.guestCanModify,
    guestCanInvite: event.guestCanInvite,
    guestCanSeeOthers: event.guestCanSeeOthers,
    guests: event.guests.map((guest) => ({
      email: guest.email,
      name: guest.name ?? undefined,
    })),
    reminders: event.reminders.map((reminder) => ({
      minutesBefore: reminder.minutesBefore,
    })),
  };
}

export function taskToFormValues(
  task: ApiTask,
  fallbackTz: string,
  durationMinutes: number,
): EventDetailsFormValues {
  const linked = task.events[0];
  const tz = task.timezone || linked?.timezone || fallbackTz;
  const startIso = task.start ?? linked?.start ?? null;
  const endIso = task.end ?? linked?.end ?? null;
  const base = linked
    ? eventToFormValues({ ...linked, title: task.name }, tz)
    : startIso
      ? eventToFormValues(
          {
            id: task.id,
            title: task.name,
            start: startIso,
            end: endIso ?? startIso,
            source: "eventra",
            googleEventId: null,
            color: task.color,
            taskId: task.id,
            ...withCalendarDefaults(task),
          },
          tz,
        )
      : {
          ...defaultFormValues(tz, durationMinutes),
          startDate: "",
          startTime: "",
          endDate: "",
          endTime: "",
        };
  return {
    ...base,
    title: task.name,
    location: task.location ?? base.location,
    description: task.description ?? base.description,
    conferenceUrl: task.conferenceUrl ?? base.conferenceUrl,
    color: task.color ?? base.color,
    allDay: task.allDay,
    timezone: tz,
    recurrence: recurrenceSelectValue(
      task.recurrence,
      startIso ? new Date(startIso) : new Date(),
    ),
    busy: task.busy,
    visibility: task.visibility,
    guestCanModify: task.guestCanModify,
    guestCanInvite: task.guestCanInvite,
    guestCanSeeOthers: task.guestCanSeeOthers,
    guests: (task.guests.length ? task.guests : base.guests).map((guest) => ({
      email: guest.email,
      name: guest.name ?? undefined,
    })),
    reminders: (task.reminders.length ? task.reminders : base.reminders).map(
      (reminder) => ({ minutesBefore: reminder.minutesBefore }),
    ),
    status: task.status,
    priority: task.priority,
    deadlineLocal: task.deadline
      ? isoToZonedParts(task.deadline, tz).date +
        "T" +
        isoToZonedParts(task.deadline, tz).time
      : "",
  };
}

export function formValuesToPayload(
  values: EventDetailsFormValues,
  options: { timesOptional: boolean },
): EventDetailsPayload {
  const tz = values.timezone || "UTC";
  const hasTimes = Boolean(values.startDate && values.endDate);
  const start =
    hasTimes
      ? zonedWallTimeToIso(
          values.startDate,
          values.allDay ? "00:00" : values.startTime || "00:00",
          tz,
        )
      : null;
  const end =
    hasTimes
      ? zonedWallTimeToIso(
          values.endDate,
          values.allDay ? "23:59" : values.endTime || "23:59",
          tz,
        )
      : null;
  if (!options.timesOptional && (!start || !end)) {
    throw new Error("Start and end are required.");
  }
  const deadline = values.deadlineLocal.trim()
    ? new Date(values.deadlineLocal).toISOString()
    : null;
  return {
    title: values.title.trim(),
    start: options.timesOptional ? start : start,
    end: options.timesOptional ? end : end,
    deadline,
    status: values.status,
    priority: values.priority,
    calendar: {
      location: values.location.trim() || null,
      description: values.description.trim() || null,
      allDay: values.allDay,
      timezone: tz,
      recurrence: values.recurrence.trim() || null,
      busy: values.busy,
      visibility: values.visibility,
      conferenceUrl: values.conferenceUrl.trim() || null,
      color: values.color,
      guestCanModify: values.guestCanModify,
      guestCanInvite: values.guestCanInvite,
      guestCanSeeOthers: values.guestCanSeeOthers,
      guests: values.guests,
      reminders: values.reminders,
    },
  };
}

type Props = {
  values: EventDetailsFormValues;
  onChange: (values: EventDetailsFormValues) => void;
  onSubmit: (values: EventDetailsFormValues) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  readOnly?: boolean;
  showTaskFields?: boolean;
  timesOptional?: boolean;
  submitting?: boolean;
  error?: string | null;
};

function IconRow({
  icon: Icon,
  children,
}: {
  icon: typeof Video;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon
        className="mt-2 size-4 shrink-0 text-zinc-500 dark:text-zinc-400"
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}

export function EventDetailsForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  readOnly = false,
  showTaskFields = false,
  timesOptional = false,
  submitting = false,
  error = null,
}: Props) {
  const id = useId();
  const [guestEmail, setGuestEmail] = useState("");
  const [showConference, setShowConference] = useState(
    Boolean(values.conferenceUrl),
  );
  const zones = useMemo(() => listTimeZones(values.timezone), [values.timezone]);
  const startDate = values.startDate
    ? new Date(`${values.startDate}T12:00:00`)
    : new Date();
  const recurrenceChoices = recurrenceOptions(startDate);
  const recurrenceValue = recurrenceSelectValue(values.recurrence, startDate);
  const customRecurrence =
    values.recurrence &&
    !recurrenceChoices.some((option) => option.value === values.recurrence);

  useEffect(() => {
    if (values.conferenceUrl) setShowConference(true);
  }, [values.conferenceUrl]);

  function patch(partial: Partial<EventDetailsFormValues>) {
    onChange({ ...values, ...partial });
  }

  function handleStartDate(nextDate: string) {
    const next = { ...values, startDate: nextDate };
    if (next.endDate && nextDate > next.endDate) next.endDate = nextDate;
    onChange(next);
  }

  function handleStartTime(nextTime: string) {
    const next = { ...values, startTime: nextTime };
    if (
      next.startDate === next.endDate &&
      next.endTime &&
      nextTime > next.endTime
    ) {
      next.endTime = nextTime;
    }
    onChange(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  function addGuest() {
    const email = guestEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (values.guests.some((guest) => guest.email === email)) {
      setGuestEmail("");
      return;
    }
    patch({ guests: [...values.guests, { email }] });
    setGuestEmail("");
  }

  const disabled = readOnly || submitting;

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <Input
        id={`${id}-title`}
        value={values.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder={showTaskFields ? "Add title" : "Add title"}
        required
        disabled={disabled}
        className="h-10 border-0 border-b border-zinc-200 bg-transparent px-0 text-lg font-medium rounded-none shadow-none focus-visible:ring-0 dark:border-zinc-700"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          aria-label="Start date"
          value={values.startDate}
          onChange={(e) => handleStartDate(e.target.value)}
          required={!timesOptional}
          disabled={disabled}
          className={pillClass}
        />
        {values.allDay ? null : (
          <Input
            type="time"
            aria-label="Start time"
            value={values.startTime}
            onChange={(e) => handleStartTime(e.target.value)}
            required={!timesOptional}
            disabled={disabled}
            className={cn(pillClass, "w-28")}
          />
        )}
        {values.allDay ? null : (
          <Input
            type="time"
            aria-label="End time"
            value={values.endTime}
            onChange={(e) => patch({ endTime: e.target.value })}
            required={!timesOptional}
            disabled={disabled}
            className={cn(pillClass, "w-28")}
          />
        )}
        <Input
          type="date"
          aria-label="End date"
          value={values.endDate}
          onChange={(e) => patch({ endDate: e.target.value })}
          required={!timesOptional}
          disabled={disabled}
          className={pillClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          aria-label="Time zone"
          value={values.timezone}
          onChange={(e) => patch({ timezone: e.target.value })}
          disabled={disabled}
          className={cn(selectClass, "max-w-full sm:max-w-xs")}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {formatTimeZoneLabel(zone)}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <Checkbox
            checked={values.allDay}
            disabled={disabled}
            onChange={(e) => patch({ allDay: e.target.checked })}
          />
          All day
        </label>
        <select
          aria-label="Repeat"
          value={customRecurrence ? values.recurrence : recurrenceValue}
          onChange={(e) => patch({ recurrence: e.target.value })}
          disabled={disabled}
          className={cn(selectClass, "max-w-full sm:max-w-xs")}
        >
          {recurrenceChoices.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
          {customRecurrence ? (
            <option value={values.recurrence}>Custom</option>
          ) : null}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <IconRow icon={Video}>
            {showConference || values.conferenceUrl ? (
              <Input
                type="url"
                value={values.conferenceUrl}
                onChange={(e) => patch({ conferenceUrl: e.target.value })}
                placeholder="Add video conferencing URL"
                disabled={disabled}
              />
            ) : (
              <Button
                type="button"
                variant="link"
                className="h-auto px-0"
                disabled={disabled}
                onClick={() => setShowConference(true)}
              >
                Add video conferencing
              </Button>
            )}
          </IconRow>

          <IconRow icon={MapPin}>
            <Input
              value={values.location}
              onChange={(e) => patch({ location: e.target.value })}
              placeholder="Add location"
              disabled={disabled}
            />
          </IconRow>

          <IconRow icon={Bell}>
            <div className="space-y-2">
              {values.reminders.map((reminder, index) => (
                <div key={`${reminder.minutesBefore}-${index}`} className="flex gap-2">
                  <select
                    aria-label={`Reminder ${index + 1}`}
                    value={reminder.minutesBefore}
                    disabled={disabled}
                    className={selectClass}
                    onChange={(e) => {
                      const next = [...values.reminders];
                      next[index] = { minutesBefore: Number(e.target.value) };
                      patch({ reminders: next });
                    }}
                  >
                    {REMINDER_PRESETS.map((preset) => (
                      <option key={preset.minutes} value={preset.minutes}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  {readOnly ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        patch({
                          reminders: values.reminders.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {readOnly ? null : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0"
                  onClick={() =>
                    patch({
                      reminders: [
                        ...values.reminders,
                        { minutesBefore: 10 },
                      ],
                    })
                  }
                >
                  Add notification
                </Button>
              )}
            </div>
          </IconRow>

          <IconRow icon={Palette}>
            <div className="space-y-1">
              <Label>Color</Label>
              <EventColorPicker
                value={values.color}
                onChange={(hex) => patch({ color: hex })}
                disabled={disabled}
              />
            </div>
          </IconRow>

          <IconRow icon={Briefcase}>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Busy or free"
                value={values.busy ? "busy" : "free"}
                disabled={disabled}
                className={cn(selectClass, "w-28")}
                onChange={(e) => patch({ busy: e.target.value === "busy" })}
              >
                <option value="busy">Busy</option>
                <option value="free">Free</option>
              </select>
              <select
                aria-label="Visibility"
                value={values.visibility}
                disabled={disabled}
                className={cn(selectClass, "w-44")}
                onChange={(e) =>
                  patch({ visibility: e.target.value as EventVisibility })
                }
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </IconRow>

          <IconRow icon={AlignLeft}>
            <Textarea
              value={values.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Add description"
              disabled={disabled}
            />
          </IconRow>

          {showTaskFields ? (
            <IconRow icon={Calendar}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${id}-status`}>Status</Label>
                  <select
                    id={`${id}-status`}
                    value={values.status}
                    disabled={disabled}
                    className={selectClass}
                    onChange={(e) =>
                      patch({ status: e.target.value as TaskBoardStatus })
                    }
                  >
                    {TASK_BOARD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TASK_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-priority`}>Priority</Label>
                  <select
                    id={`${id}-priority`}
                    value={values.priority}
                    disabled={disabled}
                    className={selectClass}
                    onChange={(e) =>
                      patch({ priority: e.target.value as TaskPriority })
                    }
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {TASK_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`${id}-deadline`}>Deadline (optional)</Label>
                  <Input
                    id={`${id}-deadline`}
                    type="datetime-local"
                    value={values.deadlineLocal}
                    disabled={disabled}
                    onChange={(e) => patch({ deadlineLocal: e.target.value })}
                  />
                </div>
              </div>
            </IconRow>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-zinc-500" aria-hidden />
            <h3 className="text-sm font-semibold">Guests</h3>
          </div>
          {readOnly ? null : (
            <div className="flex gap-2">
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Add guests"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGuest();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addGuest}>
                Add
              </Button>
            </div>
          )}
          <ul className="space-y-1">
            {values.guests.length === 0 ? (
              <li className="text-xs text-zinc-500">No guests yet.</li>
            ) : (
              values.guests.map((guest) => (
                <li
                  key={guest.email}
                  className="flex items-center justify-between rounded-md bg-zinc-50 px-2 py-1 text-sm dark:bg-zinc-900"
                >
                  <span className="truncate">{guest.email}</span>
                  {readOnly ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        patch({
                          guests: values.guests.filter(
                            (item) => item.email !== guest.email,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
          <div className="space-y-2 pt-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={values.guestCanModify}
                disabled={disabled}
                onChange={(e) => patch({ guestCanModify: e.target.checked })}
              />
              Modify event
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={values.guestCanInvite}
                disabled={disabled}
                onChange={(e) => patch({ guestCanInvite: e.target.checked })}
              />
              Invite others
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={values.guestCanSeeOthers}
                disabled={disabled}
                onChange={(e) =>
                  patch({ guestCanSeeOthers: e.target.checked })
                }
              />
              See guest list
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
        ) : null}
        {readOnly ? null : (
          <Button
            type="submit"
            disabled={submitting || !values.title.trim()}
          >
            {submitting ? "Saving…" : submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

export { defaultFormValues };
