import dayjs from "dayjs";
import type { ApiTask } from "./tasks-api";

/** Prefix for sample tasks returned when mock mode is on. */
export const MOCK_TASK_ID_PREFIX = "mock-task-";

export function isMockTaskId(id: string): boolean {
  return id.startsWith(MOCK_TASK_ID_PREFIX);
}

/** Sample tasks anchored to today (local) so list, calendar, and analytics stay interesting. */
export function buildMockTasks(): ApiTask[] {
  const day0 = dayjs().startOf("day");

  const at = (offsetDays: number, hour: number, minute: number) =>
    day0.add(offsetDays, "day").hour(hour).minute(minute).second(0).millisecond(0);

  const iso = (d: dayjs.Dayjs) => d.toISOString();

  const tasks: Omit<ApiTask, "source">[] = [
    {
      id: `${MOCK_TASK_ID_PREFIX}kickoff`,
      name: "Sprint kickoff & goals",
      startDate: iso(at(1, 9, 0)),
      endDate: iso(at(1, 11, 30)),
      progressStatus: "in_progress",
      status: "in_progress",
      priority: "high",
      deadline: iso(at(4, 17, 0)),
      scheduled: true,
      areaId: null,
      employees: [{ id: "mock-e1", name: "Jordan Lee" }],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}design-sync`,
      name: "Design sync — calendar MVP",
      startDate: iso(at(1, 14, 0)),
      endDate: iso(at(1, 15, 30)),
      progressStatus: "in_progress",
      status: "in_progress",
      priority: "medium",
      deadline: null,
      scheduled: true,
      areaId: null,
      employees: [
        { id: "mock-e2", name: "Sam Patel" },
        { id: "mock-e3", name: "Riley Cho" },
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}api-review`,
      name: "API contract review",
      startDate: iso(at(2, 10, 0)),
      endDate: iso(at(2, 11, 0)),
      progressStatus: "not_started",
      status: "todo",
      priority: "high",
      deadline: iso(at(2, 16, 0)),
      scheduled: true,
      areaId: null,
      employees: [],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}burndown`,
      name: "Update burndown & velocity",
      startDate: iso(at(2, 13, 0)),
      endDate: iso(at(2, 14, 30)),
      progressStatus: "blocked",
      status: "todo",
      priority: "medium",
      deadline: iso(at(3, 12, 0)),
      scheduled: true,
      areaId: null,
      employees: [{ id: "mock-e4", name: "Taylor Kim" }],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}qa-handoff`,
      name: "QA handoff checklist",
      startDate: iso(at(4, 9, 30)),
      endDate: iso(at(4, 12, 0)),
      progressStatus: "not_started",
      status: "todo",
      priority: "low",
      deadline: null,
      scheduled: true,
      areaId: null,
      employees: [{ id: "mock-e5", name: "Morgan Reyes" }],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}docs`,
      name: "Write settings & timezone docs",
      startDate: iso(at(-1, 11, 0)),
      endDate: iso(at(-1, 12, 0)),
      progressStatus: "completed",
      status: "done",
      priority: "medium",
      deadline: iso(at(-2, 9, 0)),
      scheduled: true,
      areaId: null,
      employees: [],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}backlog-notes`,
      name: "Backlog: offline mode spike (unscheduled)",
      startDate: iso(at(0, 12, 0)),
      endDate: iso(at(0, 12, 0)),
      progressStatus: "not_started",
      status: "todo",
      priority: "low",
      deadline: iso(at(7, 23, 59)),
      scheduled: false,
      areaId: null,
      employees: [],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}retro`,
      name: "Retro prep — gather themes",
      startDate: iso(at(5, 15, 0)),
      endDate: iso(at(5, 16, 0)),
      progressStatus: "not_started",
      status: "in_progress",
      priority: "medium",
      deadline: iso(at(5, 17, 0)),
      scheduled: true,
      areaId: null,
      employees: [{ id: "mock-e6", name: "Casey Ng" }],
    },
  ];

  return [...tasks]
    .map((task) => ({ ...task, source: "eventra" as const }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
