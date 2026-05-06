"use client";

import { Button } from "@/components/ui/button";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { TasksKanbanView } from "@/components/tasks-kanban-view";
import { TasksListView } from "@/components/tasks-list-view";
import {
  fetchTasks,
  updateTask,
  type ApiTask,
  type TaskBoardStatus,
} from "@/lib/tasks-api";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type View = "list" | "kanban";

export function TasksPanel() {
  const [view, setView] = useState<View>("list");
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      await updateTask(taskId, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            List or board view. Drag cards between columns to update status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-zinc-200 bg-zinc-50/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
            role="group"
            aria-label="View layout"
          >
            <Button
              type="button"
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setView("list")}
            >
              <List className="size-4" aria-hidden />
              List
            </Button>
            <Button
              type="button"
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No tasks yet. Create one or add from the calendar.
        </p>
      ) : view === "list" ? (
        <TasksListView tasks={tasks} onEdit={openEdit} />
      ) : (
        <TasksKanbanView
          tasks={tasks}
          onEdit={openEdit}
          onMove={handleMoveKanban}
        />
      )}

      <TaskEditDialog
        mode={dialogMode}
        open={dialogOpen}
        task={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
