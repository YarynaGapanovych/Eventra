export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

import {
  buildMockTasks,
  isMockTaskId,
  MOCK_TASK_ID_PREFIX,
} from "@/lib/mock-tasks";

export { isMockTaskId, MOCK_TASK_ID_PREFIX, buildMockTasks };

/** When true, Tasks / Analytics / calendar use sample data (no API). */
export function tasksUseMocks(): boolean {
  const v = process.env.NEXT_PUBLIC_USE_MOCK_TASKS?.toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return process.env.NODE_ENV === "development";
}

export const TASK_BOARD_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskBoardStatus = (typeof TASK_BOARD_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_LABELS: Record<TaskBoardStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export type ApiTask = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progressStatus: string;
  status: TaskBoardStatus;
  priority: TaskPriority;
  deadline: string | null;
  scheduled: boolean;
  areaId: string | null;
  employees: { id: string; name: string | null }[];
};

export async function fetchTasks(): Promise<ApiTask[]> {
  if (tasksUseMocks()) {
    return buildMockTasks();
  }
  const res = await fetch(`${API_BASE}/tasks`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /tasks failed: ${res.status}`);
  }
  return res.json();
}

export async function createTask(body: {
  name: string;
  startDate: string;
  endDate: string;
  status?: TaskBoardStatus;
  priority?: TaskPriority;
  deadline?: string;
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function updateTask(
  id: string,
  body: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    status: TaskBoardStatus;
    priority: TaskPriority;
    deadline: string | null;
  }>,
): Promise<ApiTask> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
