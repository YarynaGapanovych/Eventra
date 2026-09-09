"use client";

import { Button } from "@/components/ui/button";
import { useEventsQuery } from "@/hooks/use-events";
import { useTasksQuery } from "@/hooks/use-tasks";
import { useUserSettingsQuery } from "@/hooks/use-user-settings";
import {
  DEFAULT_APP_SETTINGS,
  getDefaultTimezone,
} from "@/lib/app-settings";
import {
  ANALYTICS_RANGES,
  computeAttention,
  computeDailyLoad,
  computeFrequentEvents,
  computePeakHours,
  computeTaskBlocksByDay,
  type AnalyticsRange,
} from "@/lib/daily-load";
import { computeDeadlines, computeUnscheduledHigh } from "@/lib/task-analytics";
import { TASK_STATUS_LABELS, type TaskBoardStatus } from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  Loader2,
  Repeat,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGES = ANALYTICS_RANGES;

const EMPTY_MESSAGES: Record<AnalyticsRange, string> = {
  "This week": "Nothing scheduled this week",
  "Last 7 days": "Nothing scheduled in the last 7 days",
  "This month": "Nothing scheduled this month",
};

type BoardCounts = {
  todo: number;
  inProgress: number;
  done: number;
};

const BOARD_ROW_COLORS: Record<TaskBoardStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#0f766e",
  done: "#334155",
};

function countBoardStatuses(tasks: { status: TaskBoardStatus }[]): BoardCounts {
  const counts: BoardCounts = { todo: 0, inProgress: 0, done: 0 };
  for (const task of tasks) {
    if (task.status === "todo") counts.todo += 1;
    else if (task.status === "in_progress") counts.inProgress += 1;
    else if (task.status === "done") counts.done += 1;
  }
  return counts;
}

const DEADLINE_LIMIT = 5;
const FREQUENT_LIMIT = 5;
const UNSCHEDULED_LIMIT = 5;
const ATTENTION_LIMIT = 6;

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function heatColor(minutes: number): string {
  if (minutes <= 0) return "rgb(244 244 245)";
  const t = Math.min(1, minutes / 60);
  const lightness = 92 - t * 48;
  return `oklch(${lightness / 100} 0.09 180)`;
}

function SectionCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/60",
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof CalendarOff; message: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <Icon className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      {message}
    </p>
  );
}

function priorityClass(priority: "High" | "Medium" | "Low") {
  return cn(
    "rounded-full px-2 py-0.5 text-[11px] font-medium",
    priority === "High" && "bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300",
    priority === "Medium" &&
      "bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
    priority === "Low" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("This week");
  const eventsQuery = useEventsQuery();
  const tasksQuery = useTasksQuery();
  const settingsQuery = useUserSettingsQuery();

  const settings = useMemo(
    () =>
      settingsQuery.data ?? {
        ...DEFAULT_APP_SETTINGS,
        timezone: getDefaultTimezone(),
      },
    [settingsQuery.data],
  );

  const hoursByDay = useMemo(
    () => computeDailyLoad(eventsQuery.data ?? [], settings, range),
    [eventsQuery.data, settings, range],
  );
  const peakHours = useMemo(
    () => computePeakHours(eventsQuery.data ?? [], settings, range),
    [eventsQuery.data, settings, range],
  );
  const frequent = useMemo(
    () =>
      computeFrequentEvents(
        eventsQuery.data ?? [],
        settings,
        range,
        FREQUENT_LIMIT,
      ),
    [eventsQuery.data, settings, range],
  );
  const attention = useMemo(
    () =>
      computeAttention(
        eventsQuery.data ?? [],
        settings,
        range,
        ATTENTION_LIMIT,
      ),
    [eventsQuery.data, settings, range],
  );
  const taskBlocks = useMemo(
    () => computeTaskBlocksByDay(eventsQuery.data ?? [], settings, range),
    [eventsQuery.data, settings, range],
  );
  const deadlines = useMemo(
    () =>
      computeDeadlines(
        tasksQuery.data ?? [],
        settings.timezone,
        DEADLINE_LIMIT,
      ),
    [tasksQuery.data, settings.timezone],
  );
  const unscheduledHigh = useMemo(
    () =>
      computeUnscheduledHigh(
        tasksQuery.data ?? [],
        settings.timezone,
        UNSCHEDULED_LIMIT,
      ),
    [tasksQuery.data, settings.timezone],
  );

  const chartLoading = eventsQuery.isPending && !eventsQuery.data;
  const chartEmpty = hoursByDay.every((day) => day.booked === 0);
  const taskBarsEmpty = taskBlocks.tasksByDay.every((day) => day.tasks === 0);
  const taskBarsAllowDecimals = taskBlocks.tasksByDay.some(
    (day) => !Number.isInteger(day.tasks),
  );
  const board = useMemo(
    () => countBoardStatuses(tasksQuery.data ?? []),
    [tasksQuery.data],
  );
  const boardTotal = board.todo + board.inProgress + board.done;
  const boardLoading = tasksQuery.isPending && !tasksQuery.data;
  const boardRows = [
    { status: "todo" as const, count: board.todo },
    { status: "in_progress" as const, count: board.inProgress },
    { status: "done" as const, count: board.done },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-1">
      <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950/60">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Schedule health: overload and slipping work.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
          {RANGES.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={range === item ? "secondary" : "ghost"}
              onClick={() => setRange(item)}
              className="h-7 rounded-md text-xs"
            >
              <CalendarRange className="size-3.5" aria-hidden />
              {item}
            </Button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-12">
        <SectionCard
          title="Loaded vs free"
          subtitle={`Booked and free time against a ${settings.workdayStart}–${settings.workdayEnd} workday · ${range}`}
          className="xl:col-span-8"
        >
          {chartLoading ? (
            <LoadingState message="Loading schedule…" />
          ) : chartEmpty ? (
            <EmptyState icon={CalendarOff} message={EMPTY_MESSAGES[range]} />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
                    contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7", fontSize: 12 }}
                    formatter={(value, name) => [
                      formatHours(Number(value ?? 0)),
                      name === "free" ? "Free" : "Booked",
                    ]}
                  />
                  <Bar dataKey="booked" stackId="load" maxBarSize={34}>
                    {hoursByDay.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={
                          entry.booked > entry.capacity && entry.capacity > 0 ? "#d97706" : "#0f766e"
                        }
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="free"
                    stackId="load"
                    fill="#e4e4e7"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <aside className="xl:col-span-4">
          <SectionCard title="Needs attention" subtitle="Overlaps and overloaded days">
            {chartLoading ? (
              <LoadingState message="Loading schedule…" />
            ) : attention.length === 0 ? (
              <EmptyState icon={CalendarOff} message="Nothing needs attention" />
            ) : (
              <div className="space-y-3">
                {attention.map((item) => (
                  <article
                    key={`${item.kind}-${item.title}-${item.detail}`}
                    className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
                  >
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-200/80">{item.detail}</p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <SectionCard
          title="Peak hours"
          subtitle={`How full each weekday hour is · ${settings.workdayStart}–${settings.workdayEnd}`}
          className="xl:col-span-8"
        >
          {chartLoading ? (
            <LoadingState message="Loading schedule…" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <div
                  className="grid min-w-md gap-1"
                  style={{
                    gridTemplateColumns: `2.5rem repeat(${Math.max(peakHours.hours.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  <div />
                  {peakHours.hours.map((hour) => (
                    <div
                      key={hour}
                      className="text-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
                    >
                      {hour}
                    </div>
                  ))}
                  {peakHours.weekdays.map((day, dayIndex) => (
                    <div key={day} className="contents">
                      <div className="flex items-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {day}
                      </div>
                      {peakHours.hours.map((hour, hourIndex) => {
                        const minutes = peakHours.minutes[dayIndex]?.[hourIndex] ?? 0;
                        return (
                          <div
                            key={`${day}-${hour}`}
                            title={`${day} ${hourLabel(hour)}–${hourLabel(hour + 1)} · ${minutes}m booked`}
                            className={cn(
                              "h-8 rounded-sm border border-zinc-200/60 dark:border-zinc-800",
                              minutes <= 0 && "bg-zinc-100 dark:bg-zinc-800",
                            )}
                            style={minutes > 0 ? { backgroundColor: heatColor(minutes) } : undefined}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {peakHours.busiest
                  ? `Busiest: ${peakHours.busiest.day} · ${peakHours.busiest.slot}`
                  : "No busy weekday hours"}
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Most frequent events" subtitle="Repeating titles in this range" className="xl:col-span-4">
          {chartLoading ? (
            <LoadingState message="Loading schedule…" />
          ) : frequent.length === 0 ? (
            <EmptyState icon={Repeat} message="No repeating events" />
          ) : (
            <ul className="space-y-3">
              {frequent.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.count}× · {formatHours(item.hours)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <SectionCard title="Board snapshot" subtitle="Open work vs done" className="lg:col-span-4">
          {boardLoading ? (
            <LoadingState message="Loading tasks…" />
          ) : boardTotal === 0 ? (
            <EmptyState icon={ClipboardList} message="No tasks yet" />
          ) : (
            <div className="space-y-3">
              {boardRows.map((row) => (
                <div key={row.status} className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="text-zinc-600 dark:text-zinc-300">{TASK_STATUS_LABELS[row.status]}</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.count}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((row.count / boardTotal) * 100)}%`,
                        backgroundColor: BOARD_ROW_COLORS[row.status],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Deadlines" subtitle="Overdue first, then the next 7 days" className="lg:col-span-4">
          {boardLoading ? (
            <LoadingState message="Loading tasks…" />
          ) : deadlines.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No overdue or upcoming deadlines" />
          ) : (
            <ul className="space-y-3">
              {deadlines.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-zinc-200/80 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.task}</p>
                    <span className={priorityClass(item.priority)}>{item.priority}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400",
                        item.overdue && "font-medium text-rose-700 dark:text-rose-300",
                      )}
                    >
                      <CalendarClock className="size-3.5" aria-hidden />
                      {item.overdue ? `Overdue · ${item.due}` : item.due}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Unscheduled high-priority"
          subtitle="Open high-priority tasks with no calendar block"
          className="lg:col-span-4"
        >
          {boardLoading ? (
            <LoadingState message="Loading tasks…" />
          ) : unscheduledHigh.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No unscheduled high-priority tasks" />
          ) : (
            <ul className="space-y-3">
              {unscheduledHigh.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.task}</p>
                    <span className={priorityClass("High")}>High</span>
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {item.due}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>

      <SectionCard
        title="Average tasks per day"
        subtitle={`Task-linked blocks only · avg ${taskBlocks.avgTasksPerWorkday} / workday · ${range}`}
      >
        {chartLoading ? (
          <LoadingState message="Loading schedule…" />
        ) : taskBarsEmpty ? (
          <EmptyState icon={ClipboardList} message="No task blocks in this range" />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskBlocks.tasksByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={taskBarsAllowDecimals}
                />
                <Tooltip
                  cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
                  contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7", fontSize: 12 }}
                  formatter={(value) => [`${Number(value ?? 0)}`, "Task blocks"]}
                />
                <Bar dataKey="tasks" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
