"use client";

import { Button } from "@/components/ui/button";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ApiTask,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

function priorityClass(p: ApiTask["priority"]) {
  if (p === "high")
    return "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200";
  if (p === "medium")
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

type Props = {
  tasks: ApiTask[];
  onEdit: (task: ApiTask) => void;
};

export function TasksListView({ tasks, onEdit }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white/80 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/90 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Start – end</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {tasks.map((task) => (
            <tr key={task.id} className="text-zinc-800 dark:text-zinc-200">
              <td className="px-4 py-3 font-medium">{task.name}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    priorityClass(task.priority),
                  )}
                >
                  {TASK_PRIORITY_LABELS[task.priority]}
                </span>
              </td>
              <td className="px-4 py-3">
                {TASK_STATUS_LABELS[task.status]}
              </td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                {task.deadline ? dayjs(task.deadline).format("MMM D, YYYY HH:mm") : "—"}
              </td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                {dayjs(task.startDate).format("MMM D HH:mm")}
                {" — "}
                {dayjs(task.endDate).format("MMM D HH:mm")}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onEdit(task)}
                >
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
