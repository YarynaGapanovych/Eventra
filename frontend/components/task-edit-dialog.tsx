"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { loadAppSettings } from "@/lib/app-settings";
import {
  createTask,
  isMockTaskId,
  MOCK_TASK_ID_PREFIX,
  updateTask,
  type ApiTask,
  TASK_BOARD_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  type TaskBoardStatus,
  type TaskPriority,
} from "@/lib/tasks-api";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

function datetimeLocal(iso: string) {
  return dayjs(iso).format("YYYY-MM-DDTHH:mm");
}

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
  const [name, setName] = useState("");
  const [startLocal, setStartLocal] = useState(() => {
    const settings = loadAppSettings();
    const [wh, wm] = settings.workdayStart.split(":").map(Number);
    const hour = Number.isFinite(wh) ? wh : 9;
    const minute = Number.isFinite(wm) ? wm : 0;
    return dayjs().hour(hour).minute(minute).second(0).format("YYYY-MM-DDTHH:mm");
  });
  const [endLocal, setEndLocal] = useState(() => {
    const settings = loadAppSettings();
    const [wh, wm] = settings.workdayStart.split(":").map(Number);
    const hour = Number.isFinite(wh) ? wh : 9;
    const minute = Number.isFinite(wm) ? wm : 0;
    const start = dayjs().hour(hour).minute(minute).second(0);
    const mins = Math.max(15, settings.defaultEventDurationMinutes);
    return start.add(mins, "minute").format("YYYY-MM-DDTHH:mm");
  });
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [status, setStatus] = useState<TaskBoardStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    if (mode === "edit" && task) {
      setName(task.name);
      setStartLocal(datetimeLocal(task.startDate));
      setEndLocal(datetimeLocal(task.endDate));
      setDeadlineLocal(task.deadline ? datetimeLocal(task.deadline) : "");
      setStatus(task.status);
      setPriority(task.priority);
    } else {
      const settings = loadAppSettings();
      const [wh, wm] = settings.workdayStart.split(":").map(Number);
      const hour = Number.isFinite(wh) ? wh : 9;
      const minute = Number.isFinite(wm) ? wm : 0;
      let start = dayjs().hour(hour).minute(minute).second(0);
      if (start.isBefore(dayjs())) {
        start = dayjs().add(1, "minute").second(0);
      }
      const mins = Math.max(15, settings.defaultEventDurationMinutes);
      setName("");
      setStartLocal(start.format("YYYY-MM-DDTHH:mm"));
      setEndLocal(start.add(mins, "minute").format("YYYY-MM-DDTHH:mm"));
      setDeadlineLocal("");
      setStatus("todo");
      setPriority("medium");
    }
  }, [open, mode, task]);

  if (!open) return null;

  const title = mode === "create" ? "New task" : "Edit task";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const startDate = dayjs(startLocal).toISOString();
      const endDate = dayjs(endLocal).toISOString();

      if (dayjs(endLocal).isBefore(dayjs(startLocal))) {
        setError("End must be after start.");
        return;
      }

      const deadlineTrim = deadlineLocal.trim();
      if (deadlineTrim) {
        const dl = dayjs(deadlineTrim).toISOString();
        if (!dl || Number.isNaN(Date.parse(dl))) {
          setError("Invalid deadline.");
          return;
        }
      }

      if (mockPersist && mode === "create") {
        const idSuffix =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Date.now().toString(36);
        const fresh: ApiTask = {
          id: `${MOCK_TASK_ID_PREFIX}${idSuffix}`,
          name: name.trim(),
          startDate,
          endDate,
          progressStatus: progressLabelForBoardStatus(status),
          status,
          priority,
          deadline: deadlineTrim ? dayjs(deadlineTrim).toISOString() : null,
          scheduled: false,
          areaId: null,
          employees: [],
        };
        onMockPersist?.(fresh);
        onClose();
        onSaved();
        return;
      }

      if (mockPersist && mode === "edit" && task && isMockTaskId(task.id)) {
        const updated: ApiTask = {
          ...task,
          name: name.trim(),
          startDate,
          endDate,
          status,
          priority,
          progressStatus: progressLabelForBoardStatus(status),
        };
        const hadDeadline = Boolean(task.deadline);
        if (deadlineTrim) {
          updated.deadline = dayjs(deadlineTrim).toISOString();
        } else if (hadDeadline) {
          updated.deadline = null;
        }
        onMockPersist?.(updated);
        onClose();
        onSaved();
        return;
      }

      if (mode === "create") {
        await createTask({
          name: name.trim(),
          startDate,
          endDate,
          status,
          priority,
          ...(deadlineTrim ? { deadline: dayjs(deadlineTrim).toISOString() } : {}),
        });
      } else if (task) {
        const body: Partial<{
          name: string;
          startDate: string;
          endDate: string;
          status: TaskBoardStatus;
          priority: TaskPriority;
          deadline: string | null;
        }> = {
          name: name.trim(),
          startDate,
          endDate,
          status,
          priority,
        };
        const hadDeadline = Boolean(task.deadline);
        if (deadlineTrim) {
          body.deadline = dayjs(deadlineTrim).toISOString();
        } else if (hadDeadline) {
          body.deadline = null;
        }
        await updateTask(task.id, body);
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
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
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

        <form className="mt-4 space-y-4" onSubmit={(ev) => void submit(ev)}>
          <div className="space-y-2">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-start">Start</Label>
              <Input
                id="task-start"
                type="datetime-local"
                value={startLocal}
                onChange={(ev) => setStartLocal(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-end">End</Label>
              <Input
                id="task-end"
                type="datetime-local"
                value={endLocal}
                min={startLocal}
                onChange={(ev) => setEndLocal(ev.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-deadline">Deadline (optional)</Label>
            <Input
              id="task-deadline"
              type="datetime-local"
              value={deadlineLocal}
              onChange={(ev) => setDeadlineLocal(ev.target.value)}
            />
            {mode === "edit" && task?.deadline && !deadlineLocal ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Clear the field and save to remove the deadline.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                value={status}
                onChange={(ev) =>
                  setStatus(ev.target.value as TaskBoardStatus)
                }
                className={cn(
                  "flex h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-sm shadow-none outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:border-zinc-700 dark:bg-zinc-950",
                )}
              >
                {TASK_BOARD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                value={priority}
                onChange={(ev) =>
                  setPriority(ev.target.value as TaskPriority)
                }
                className={cn(
                  "flex h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-sm shadow-none outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:border-zinc-700 dark:bg-zinc-950",
                )}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
