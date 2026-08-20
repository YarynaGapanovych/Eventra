export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

import {
  buildMockTasks,
  isMockTaskId,
  MOCK_TASK_ID_PREFIX,
} from "@/lib/mock-tasks";
import {
  EMPTY_CALENDAR_DETAILS,
  withCalendarDefaults,
  type CalendarDetails,
  type CalendarDetailsInput,
} from "@/lib/calendar-details";
import { normalizeApiEvent, type ApiEvent } from "@/lib/events-api";

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

export type ApiTaskEvent = ApiEvent;

export type ApiTask = {
  id: string;
  name: string;
  progressStatus: string;
  status: TaskBoardStatus;
  priority: TaskPriority;
  deadline: string | null;
  areaId: string | null;
  start: string | null;
  end: string | null;
  color: string | null;
  employees: { id: string; name: string | null }[];
  events: ApiTaskEvent[];
} & CalendarDetails;

export type CreateTaskInput = {
  name: string;
  status?: TaskBoardStatus;
  priority?: TaskPriority;
  deadline?: string;
  start?: string;
  end?: string;
} & CalendarDetailsInput;

export type UpdateTaskInput = Partial<{
  name: string;
  status: TaskBoardStatus;
  priority: TaskPriority;
  deadline: string | null;
  start: string | null;
  end: string | null;
}> & CalendarDetailsInput;

export function normalizeApiTask(task: ApiTask): ApiTask {
  return {
    ...EMPTY_CALENDAR_DETAILS,
    ...task,
    ...withCalendarDefaults(task),
    start: task.start ?? null,
    end: task.end ?? null,
    color: task.color ?? null,
    events: (task.events ?? []).map((event) => normalizeApiEvent(event)),
  };
}
