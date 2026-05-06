export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
