import { TasksPanel } from "@/components/tasks-panel";
import { Suspense } from "react";

export default function TasksPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>}
    >
      <TasksPanel />
    </Suspense>
  );
}
