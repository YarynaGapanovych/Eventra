import { isoToZonedParts } from "@/lib/calendar-details";
import {
  type ApiTask,
  type TaskPriority,
} from "@/lib/tasks-api";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type DeadlineItem = {
  id: string;
  task: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  overdue: boolean;
};

export type UnscheduledTask = {
  id: string;
  task: string;
  due: string;
};

function addDays(date: string, delta: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

function zonedToday(now: Date, timeZone: string): string {
  return isoToZonedParts(now.toISOString(), timeZone).date;
}

function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? date;
}

function formatClock(time: string): string {
  const [hourRaw, minuteRaw] = time.split(":").map(Number);
  const hour = hourRaw ?? 0;
  const minute = minuteRaw ?? 0;
  if (hour === 0 && minute === 0) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function withTime(label: string, time: string): string {
  const clock = formatClock(time);
  return clock ? `${label} ${clock}` : label;
}

function formatRelativeDue(
  deadline: string,
  today: string,
  timeZone: string,
  overdue: boolean,
): string {
  const parts = isoToZonedParts(deadline, timeZone);
  const diff =
    (new Date(`${parts.date}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
    86_400_000;

  if (overdue) {
    if (diff === -1) return "Yesterday";
    return `${Math.abs(diff)} days ago`;
  }
  if (diff === 0) return withTime("Today", parts.time);
  if (diff === 1) return withTime("Tomorrow", parts.time);
  return withTime(weekdayLabel(parts.date), parts.time);
}

function priorityLabel(priority: TaskPriority): DeadlineItem["priority"] {
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Low";
}

export function computeDeadlines(
  tasks: ApiTask[],
  timeZone: string,
  limit = 5,
  now: Date = new Date(),
): DeadlineItem[] {
  const today = zonedToday(now, timeZone);
  const until = addDays(today, 7);
  const items: (DeadlineItem & { date: string })[] = [];

  for (const task of tasks) {
    if (task.status === "done" || !task.deadline) continue;
    const date = isoToZonedParts(task.deadline, timeZone).date;
    const overdue = date < today;
    const upcoming = date >= today && date <= until;
    if (!overdue && !upcoming) continue;
    items.push({
      id: task.id,
      task: task.name,
      due: formatRelativeDue(task.deadline, today, timeZone, overdue),
      priority: priorityLabel(task.priority),
      overdue,
      date,
    });
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.overdue ? a.date.localeCompare(b.date) : a.date.localeCompare(b.date);
  });

  return items.slice(0, limit).map((item) => ({
    id: item.id,
    task: item.task,
    due: item.due,
    priority: item.priority,
    overdue: item.overdue,
  }));
}

export function computeUnscheduledHigh(
  tasks: ApiTask[],
  timeZone: string,
  limit = 5,
): UnscheduledTask[] {
  return tasks
    .filter(
      (task) =>
        task.priority === "high" &&
        task.status !== "done" &&
        (task.events?.length ?? 0) === 0,
    )
    .map((task) => ({
      id: task.id,
      task: task.name,
      due: task.deadline
        ? weekdayLabel(isoToZonedParts(task.deadline, timeZone).date)
        : "No date",
    }))
    .slice(0, limit);
}
