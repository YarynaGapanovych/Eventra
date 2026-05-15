"use client";

import { TaskEditDialog } from "@/components/task-edit-dialog";
import { TasksKanbanView } from "@/components/tasks-kanban-view";
import { TasksListView } from "@/components/tasks-list-view";
import { Button } from "@/components/ui/button";
import {
  fetchTasks,
  isMockTaskId,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  tasksUseMocks,
  updateTask,
  type ApiTask,
  type TaskBoardStatus,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type View = "list" | "kanban";

function taskMatchesQuery(task: ApiTask, q: string): boolean {
  const n = q.toLowerCase();
  if (task.name.toLowerCase().includes(n)) return true;
  if (task.progressStatus.replace(/_/g, " ").toLowerCase().includes(n))
    return true;
  if (TASK_STATUS_LABELS[task.status].toLowerCase().includes(n)) return true;
  if (TASK_PRIORITY_LABELS[task.priority].toLowerCase().includes(n))
    return true;
  return task.employees.some((e) => (e.name ?? "").toLowerCase().includes(n));
}

export function TasksPanel() {
  const searchParams = useSearchParams();
  const queryRaw = searchParams.get("q")?.trim() ?? "";

  const [view, setView] = useState<View>("list");
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mockActive = tasksUseMocks();

  const filteredTasks = useMemo(() => {
    if (!queryRaw) return tasks;
    return tasks.filter((t) => taskMatchesQuery(t, queryRaw));
  }, [tasks, queryRaw]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ApiTask | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchTasks();
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setDialogMode("create");
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (task: ApiTask) => {
    setDialogMode("edit");
    setEditing(task);
    setDialogOpen(true);
  };

  const handleMoveKanban = async (taskId: string, status: TaskBoardStatus) => {
    try {
      if (mockActive && isMockTaskId(taskId)) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
        );
        return;
      }
      await updateTask(taskId, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task.");
    }
  };

  function mergePersistedTask(updated: ApiTask) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id);
      const next =
        idx === -1
          ? [...prev, updated]
          : prev.map((t, i) => (i === idx ? updated : t));
      return [...next].sort((a, b) => a.startDate.localeCompare(b.startDate));
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            List or board view. Drag cards between columns to update status.
          </p>
        </div> */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="View layout"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-md border border-transparent",
                view === "list"
                  ? "border-zinc-300 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
              onClick={() => setView("list")}
            >
              <List className="size-4" aria-hidden />
              List
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-md border border-transparent",
                view === "kanban"
                  ? "border-zinc-300 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="size-4" aria-hidden />
              Kanban
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
            onClick={openCreate}
          >
            <Plus className="size-4" aria-hidden />
            New task
          </Button>
        </div>
      </header>

      {mockActive ? (
        <p
          className="rounded-lg border border-teal-200/80 bg-teal-50/90 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/35 dark:text-teal-50"
          role="status"
        >
          Showing sample tasks (mock mode).{" "}
          <span className="text-teal-800/95 dark:text-teal-200/90">
            Set{" "}
            <code className="rounded bg-white/70 px-1 font-mono text-xs dark:bg-zinc-900/70">
              NEXT_PUBLIC_USE_MOCK_TASKS=false
            </code>{" "}
            to use your API instead.
          </span>
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-md text-zinc-600 dark:text-zinc-400">
          No tasks yet. Create one or add from the calendar.
        </p>
      ) : filteredTasks.length === 0 && queryRaw ? (
        <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-6 text-center text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
          <p>
            No tasks match{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              &ldquo;{queryRaw}&rdquo;
            </span>
            .
          </p>
          <Link
            href="/tasks"
            className="mt-3 inline-block text-sm font-medium text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
          >
            Clear search
          </Link>
        </div>
      ) : view === "list" ? (
        <TasksListView tasks={filteredTasks} onEdit={openEdit} />
      ) : (
        <TasksKanbanView
          tasks={filteredTasks}
          onEdit={openEdit}
          onMove={handleMoveKanban}
        />
      )}

      <TaskEditDialog
        mode={dialogMode}
        open={dialogOpen}
        task={editing}
        mockPersist={mockActive}
        onMockPersist={mergePersistedTask}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          if (!mockActive) void load();
        }}
      />
    </div>
  );
}
