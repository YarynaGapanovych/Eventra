import dayjs from "dayjs";
import type { ApiEvent } from "./events-api";
import type { ApiTask } from "./tasks-api";

/** Prefix for sample tasks returned when mock mode is on. */
export const MOCK_TASK_ID_PREFIX = "mock-task-";
export const MOCK_EVENT_ID_PREFIX = "mock-event-";

export function isMockTaskId(id: string): boolean {
  return id.startsWith(MOCK_TASK_ID_PREFIX);
}

export function isMockEventId(id: string): boolean {
  return id.startsWith(MOCK_EVENT_ID_PREFIX) || id.startsWith("task:");
}

/** Sample tasks anchored to today (local) so list, calendar, and analytics stay interesting. */
export function buildMockTasks(): ApiTask[] {
  const day0 = dayjs().startOf("day");

  const at = (offsetDays: number, hour: number, minute: number) =>
    day0.add(offsetDays, "day").hour(hour).minute(minute).second(0).millisecond(0);

  const iso = (d: dayjs.Dayjs) => d.toISOString();

  const event = (
    id: string,
    taskId: string,
    title: string,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
  ): ApiTask["events"][number] => ({
    id: `${MOCK_EVENT_ID_PREFIX}${id}`,
    title,
    start: iso(start),
    end: iso(end),
    source: "eventra",
    googleEventId: null,
    color: null,
    taskId,
  });

  const tasks: ApiTask[] = [
    {
      id: `${MOCK_TASK_ID_PREFIX}kickoff`,
      name: "Sprint kickoff & goals",
      progressStatus: "in_progress",
      status: "in_progress",
      priority: "high",
      deadline: iso(at(4, 17, 0)),
      areaId: null,
      employees: [{ id: "mock-e1", name: "Jordan Lee" }],
      events: [
        event(
          "kickoff",
          `${MOCK_TASK_ID_PREFIX}kickoff`,
          "Sprint kickoff & goals",
          at(1, 9, 0),
          at(1, 11, 30),
        ),
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}design-sync`,
      name: "Design sync — calendar MVP",
      progressStatus: "in_progress",
      status: "in_progress",
      priority: "medium",
      deadline: null,
      areaId: null,
      employees: [
        { id: "mock-e2", name: "Sam Patel" },
        { id: "mock-e3", name: "Riley Cho" },
      ],
      events: [
        event(
          "design-sync",
          `${MOCK_TASK_ID_PREFIX}design-sync`,
          "Design sync — calendar MVP",
          at(1, 14, 0),
          at(1, 15, 30),
        ),
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}api-review`,
      name: "API contract review",
      progressStatus: "not_started",
      status: "todo",
      priority: "high",
      deadline: iso(at(2, 16, 0)),
      areaId: null,
      employees: [],
      events: [
        event(
          "api-review",
          `${MOCK_TASK_ID_PREFIX}api-review`,
          "API contract review",
          at(2, 10, 0),
          at(2, 11, 0),
        ),
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}burndown`,
      name: "Update burndown & velocity",
      progressStatus: "blocked",
      status: "todo",
      priority: "medium",
      deadline: iso(at(3, 12, 0)),
      areaId: null,
      employees: [{ id: "mock-e4", name: "Taylor Kim" }],
      events: [
        event(
          "burndown",
          `${MOCK_TASK_ID_PREFIX}burndown`,
          "Update burndown & velocity",
          at(2, 13, 0),
          at(2, 14, 30),
        ),
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}qa-handoff`,
      name: "QA handoff checklist",
      progressStatus: "not_started",
      status: "todo",
      priority: "low",
      deadline: null,
      areaId: null,
      employees: [{ id: "mock-e5", name: "Morgan Reyes" }],
      events: [
        event(
          "qa-handoff",
          `${MOCK_TASK_ID_PREFIX}qa-handoff`,
          "QA handoff checklist",
          at(4, 9, 30),
          at(4, 12, 0),
        ),
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}docs`,
      name: "Write settings & timezone docs",
      progressStatus: "completed",
      status: "done",
      priority: "medium",
      deadline: iso(at(-2, 9, 0)),
      areaId: null,
      employees: [],
      events: [
        event(
          "docs",
          `${MOCK_TASK_ID_PREFIX}docs`,
          "Write settings & timezone docs",
          at(-1, 11, 0),
          at(-1, 12, 0),
        ),
      ],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}backlog-notes`,
      name: "Backlog: offline mode spike (unscheduled)",
      progressStatus: "not_started",
      status: "todo",
      priority: "low",
      deadline: iso(at(7, 23, 59)),
      areaId: null,
      employees: [],
      events: [],
    },
    {
      id: `${MOCK_TASK_ID_PREFIX}retro`,
      name: "Retro prep — gather themes",
      progressStatus: "not_started",
      status: "in_progress",
      priority: "medium",
      deadline: iso(at(5, 17, 0)),
      areaId: null,
      employees: [{ id: "mock-e6", name: "Casey Ng" }],
      events: [
        event(
          "retro",
          `${MOCK_TASK_ID_PREFIX}retro`,
          "Retro prep — gather themes",
          at(5, 15, 0),
          at(5, 16, 0),
        ),
      ],
    },
  ];

  return tasks;
}

export function buildMockEvents(tasks: ApiTask[] = buildMockTasks()): ApiEvent[] {
  const fromTasks = tasks.flatMap((task) => task.events);
  const day0 = dayjs().startOf("day");
  const standup: ApiEvent = {
    id: `${MOCK_EVENT_ID_PREFIX}google-standup`,
    title: "Team standup",
    start: day0.add(1, "day").hour(10).minute(0).toISOString(),
    end: day0.add(1, "day").hour(10).minute(30).toISOString(),
    source: "google",
    googleEventId: "mock-google-standup",
    color: "#5484ED",
    taskId: null,
  };
  return [...fromTasks, standup].sort((a, b) => a.start.localeCompare(b.start));
}
