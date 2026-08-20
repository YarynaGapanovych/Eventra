"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  Repeat,
} from "lucide-react";
import { useState } from "react";
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

const RANGES = ["This week", "Last 7 days", "This month"] as const;
type AnalyticsRange = (typeof RANGES)[number];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const WORK_HOURS = [9, 10, 11, 12, 13, 14, 15, 16] as const;

type DayHours = {
  day: string;
  booked: number;
  free: number;
  capacity: number;
};

type AttentionItem = {
  kind: "overlap" | "overload";
  title: string;
  detail: string;
};

type DeadlineItem = {
  task: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  overdue: boolean;
};

type FrequentEvent = {
  title: string;
  count: number;
  hours: number;
};

type TasksByDay = {
  day: string;
  tasks: number;
};

type UnscheduledTask = {
  task: string;
  due: string;
};

type BoardCounts = {
  todo: number;
  inProgress: number;
  done: number;
};

type RangeSnapshot = {
  hoursByDay: DayHours[];
  peakMinutes: number[][];
  busiest: { day: string; slot: string };
  frequent: FrequentEvent[];
  tasksByDay: TasksByDay[];
  avgTasksPerWorkday: number;
  attention: AttentionItem[];
  deadlines: DeadlineItem[];
  unscheduledHigh: UnscheduledTask[];
};

const BOARD: BoardCounts = { todo: 5, inProgress: 3, done: 4 };
const DEADLINE_LIMIT = 5;
const FREQUENT_LIMIT = 5;
const UNSCHEDULED_LIMIT = 5;

function dayLoad(day: string, booked: number, capacity: number): DayHours {
  return {
    day,
    booked,
    capacity,
    free: Math.max(0, Math.round((capacity - booked) * 10) / 10),
  };
}

const SNAPSHOTS: Record<AnalyticsRange, RangeSnapshot> = {
  "This week": {
    hoursByDay: [
      dayLoad("Mon", 6.5, 8),
      dayLoad("Tue", 8.2, 8),
      dayLoad("Wed", 9.1, 8),
      dayLoad("Thu", 6, 8),
      dayLoad("Fri", 5.2, 8),
      dayLoad("Sat", 2, 0),
      dayLoad("Sun", 0, 0),
    ],
    peakMinutes: [
      [20, 45, 30, 15, 50, 40, 10, 0],
      [40, 55, 60, 35, 50, 45, 25, 10],
      [50, 60, 60, 45, 55, 50, 40, 20],
      [15, 50, 25, 10, 40, 30, 20, 5],
      [10, 20, 35, 15, 40, 25, 15, 0],
    ],
    busiest: { day: "Wed", slot: "10:00–11:00" },
    frequent: [
      { title: "Team standup", count: 4, hours: 2 },
      { title: "Design sync", count: 3, hours: 4.5 },
      { title: "1:1", count: 2, hours: 1.5 },
      { title: "API review", count: 2, hours: 2 },
      { title: "Focus block", count: 2, hours: 3 },
    ],
    tasksByDay: [
      { day: "Mon", tasks: 3 },
      { day: "Tue", tasks: 4 },
      { day: "Wed", tasks: 5 },
      { day: "Thu", tasks: 2 },
      { day: "Fri", tasks: 2 },
    ],
    avgTasksPerWorkday: 3.2,
    attention: [
      {
        kind: "overlap",
        title: "Design sync overlaps standup",
        detail: "Tue 14:00–15:30 and Team standup 14:15–15:00.",
      },
      {
        kind: "overlap",
        title: "API review overlaps 1:1",
        detail: "Thu 10:00–11:00 and 10:30–11:15.",
      },
      {
        kind: "overload",
        title: "Wednesday is overloaded",
        detail: "9.1h booked against an 8h workday.",
      },
      {
        kind: "overload",
        title: "Tuesday is slightly over",
        detail: "8.2h booked against an 8h workday.",
      },
    ],
    deadlines: [
      {
        task: "Write Q1 wrap-up notes",
        due: "2 days ago",
        priority: "High",
        overdue: true,
      },
      {
        task: "Share hiring scorecard",
        due: "Yesterday",
        priority: "Medium",
        overdue: true,
      },
      {
        task: "Confirm vendor invoice",
        due: "3 days ago",
        priority: "Low",
        overdue: true,
      },
      {
        task: "Sprint kickoff & goals",
        due: "Fri 5:00 PM",
        priority: "High",
        overdue: false,
      },
      {
        task: "API contract review",
        due: "Wed 4:00 PM",
        priority: "High",
        overdue: false,
      },
    ],
    unscheduledHigh: [
      { task: "Security review for auth", due: "Thu" },
      { task: "Customer interview notes", due: "Fri" },
      { task: "Offline mode spike", due: "No date" },
    ],
  },
  "Last 7 days": {
    hoursByDay: [
      dayLoad("Thu", 5.5, 8),
      dayLoad("Fri", 7, 8),
      dayLoad("Sat", 1.5, 0),
      dayLoad("Sun", 0, 0),
      dayLoad("Mon", 6, 8),
      dayLoad("Tue", 8.4, 8),
      dayLoad("Wed", 3.1, 8),
    ],
    peakMinutes: [
      [15, 40, 25, 10, 45, 30, 15, 0],
      [45, 60, 50, 20, 55, 50, 30, 15],
      [20, 25, 15, 5, 20, 10, 5, 0],
      [10, 45, 20, 10, 35, 25, 10, 0],
      [25, 40, 50, 20, 45, 20, 10, 0],
    ],
    busiest: { day: "Tue", slot: "10:00–11:00" },
    frequent: [
      { title: "Team standup", count: 5, hours: 2.5 },
      { title: "Planning", count: 2, hours: 2 },
      { title: "1:1", count: 2, hours: 1.5 },
      { title: "Focus block", count: 2, hours: 2.5 },
    ],
    tasksByDay: [
      { day: "Mon", tasks: 2 },
      { day: "Tue", tasks: 4 },
      { day: "Wed", tasks: 1 },
      { day: "Thu", tasks: 3 },
      { day: "Fri", tasks: 3 },
    ],
    avgTasksPerWorkday: 2.6,
    attention: [
      {
        kind: "overlap",
        title: "Planning overlaps focus block",
        detail: "Tue 11:00–12:00 and 11:30–12:30.",
      },
      {
        kind: "overload",
        title: "Tuesday is overloaded",
        detail: "8.4h booked against an 8h workday.",
      },
    ],
    deadlines: [
      {
        task: "Write Q1 wrap-up notes",
        due: "2 days ago",
        priority: "High",
        overdue: true,
      },
      {
        task: "Share hiring scorecard",
        due: "Yesterday",
        priority: "Medium",
        overdue: true,
      },
      {
        task: "Confirm vendor invoice",
        due: "3 days ago",
        priority: "Low",
        overdue: true,
      },
      {
        task: "API contract review",
        due: "Tomorrow 4:00 PM",
        priority: "High",
        overdue: false,
      },
      {
        task: "Update burndown & velocity",
        due: "In 2 days",
        priority: "Medium",
        overdue: false,
      },
    ],
    unscheduledHigh: [
      { task: "Security review for auth", due: "Thu" },
      { task: "Customer interview notes", due: "Fri" },
    ],
  },
  "This month": {
    hoursByDay: [
      dayLoad("Week 1", 34, 40),
      dayLoad("Week 2", 41, 40),
      dayLoad("Week 3", 29, 40),
      dayLoad("Week 4", 24, 40),
    ],
    peakMinutes: [
      [25, 40, 35, 20, 45, 35, 15, 5],
      [40, 55, 50, 30, 50, 45, 25, 10],
      [50, 60, 55, 40, 55, 50, 35, 15],
      [20, 40, 30, 15, 40, 30, 20, 5],
      [15, 30, 35, 20, 40, 25, 15, 5],
    ],
    busiest: { day: "Wed", slot: "10:00–11:00" },
    frequent: [
      { title: "Team standup", count: 18, hours: 9 },
      { title: "1:1", count: 8, hours: 6 },
      { title: "Design sync", count: 6, hours: 9 },
      { title: "Sprint planning", count: 4, hours: 6 },
      { title: "Focus block", count: 4, hours: 8 },
    ],
    tasksByDay: [
      { day: "Mon", tasks: 2.8 },
      { day: "Tue", tasks: 3.6 },
      { day: "Wed", tasks: 4.1 },
      { day: "Thu", tasks: 2.4 },
      { day: "Fri", tasks: 2.1 },
    ],
    avgTasksPerWorkday: 3,
    attention: [
      {
        kind: "overlap",
        title: "Design sync overlaps standup",
        detail: "Tue 14:00–15:30 and Team standup 14:15–15:00.",
      },
      {
        kind: "overlap",
        title: "API review overlaps 1:1",
        detail: "Thu 10:00–11:00 and 10:30–11:15.",
      },
      {
        kind: "overlap",
        title: "Retro prep overlaps wrap-up",
        detail: "Fri 15:00–16:00 and 15:30–16:30.",
      },
      {
        kind: "overload",
        title: "Week 2 is overloaded",
        detail: "41h booked against 40h workday capacity.",
      },
    ],
    deadlines: [
      {
        task: "Write Q1 wrap-up notes",
        due: "2 days ago",
        priority: "High",
        overdue: true,
      },
      {
        task: "Share hiring scorecard",
        due: "Yesterday",
        priority: "Medium",
        overdue: true,
      },
      {
        task: "Confirm vendor invoice",
        due: "3 days ago",
        priority: "Low",
        overdue: true,
      },
      {
        task: "Sprint kickoff & goals",
        due: "Fri 5:00 PM",
        priority: "High",
        overdue: false,
      },
      {
        task: "Retro prep — gather themes",
        due: "Next week",
        priority: "Medium",
        overdue: false,
      },
    ],
    unscheduledHigh: [
      { task: "Security review for auth", due: "Thu" },
      { task: "Customer interview notes", due: "Fri" },
      { task: "Offline mode spike", due: "No date" },
      { task: "Incident playbook draft", due: "No date" },
    ],
  },
};

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

function priorityClass(priority: DeadlineItem["priority"]) {
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
  const snapshot = SNAPSHOTS[range];
  const deadlines = snapshot.deadlines.slice(0, DEADLINE_LIMIT);
  const frequent = snapshot.frequent.slice(0, FREQUENT_LIMIT);
  const unscheduledHigh = snapshot.unscheduledHigh.slice(0, UNSCHEDULED_LIMIT);
  const boardTotal = BOARD.todo + BOARD.inProgress + BOARD.done;
  const chartEmpty = snapshot.hoursByDay.every((day) => day.booked === 0);

  const boardRows = [
    { label: "To do", count: BOARD.todo, color: "#94a3b8" },
    { label: "In progress", count: BOARD.inProgress, color: "#0f766e" },
    { label: "Done", count: BOARD.done, color: "#334155" },
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
          subtitle={`Booked and free time against a 09:00–17:00 workday · ${range}`}
          className="xl:col-span-8"
        >
          {chartEmpty ? (
            <EmptyState icon={CalendarOff} message="Nothing scheduled this week" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.hoursByDay}>
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
                    {snapshot.hoursByDay.map((entry) => (
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
            {snapshot.attention.length === 0 ? (
              <EmptyState icon={CalendarOff} message="No overlaps" />
            ) : (
              <div className="space-y-3">
                {snapshot.attention.map((item) => (
                  <article
                    key={item.title}
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
          subtitle="How full each weekday hour is · 09:00–17:00"
          className="xl:col-span-8"
        >
          <div className="overflow-x-auto">
            <div
              className="grid min-w-md gap-1"
              style={{ gridTemplateColumns: `2.5rem repeat(${WORK_HOURS.length}, minmax(0, 1fr))` }}
            >
              <div />
              {WORK_HOURS.map((hour) => (
                <div
                  key={hour}
                  className="text-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
                >
                  {hour}
                </div>
              ))}
              {WEEKDAYS.map((day, dayIndex) => (
                <div key={day} className="contents">
                  <div className="flex items-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {day}
                  </div>
                  {WORK_HOURS.map((hour, hourIndex) => {
                    const minutes = snapshot.peakMinutes[dayIndex]?.[hourIndex] ?? 0;
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
            Busiest: {snapshot.busiest.day} · {snapshot.busiest.slot}
          </p>
        </SectionCard>

        <SectionCard title="Most frequent events" subtitle="Repeating titles in this range" className="xl:col-span-4">
          {frequent.length === 0 ? (
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
          {boardTotal === 0 ? (
            <EmptyState icon={ClipboardList} message="No tasks yet" />
          ) : (
            <div className="space-y-3">
              {boardRows.map((row) => (
                <div key={row.label} className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="text-zinc-600 dark:text-zinc-300">{row.label}</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.count}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((row.count / boardTotal) * 100)}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Deadlines" subtitle="Overdue first, then the next 7 days" className="lg:col-span-4">
          {deadlines.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No overdue tasks" />
          ) : (
            <ul className="space-y-3">
              {deadlines.map((item) => (
                <li
                  key={item.task}
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
          {unscheduledHigh.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No unscheduled high-priority tasks" />
          ) : (
            <ul className="space-y-3">
              {unscheduledHigh.map((item) => (
                <li
                  key={item.task}
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
        subtitle={`Task-linked blocks only · avg ${snapshot.avgTasksPerWorkday} / workday · ${range}`}
      >
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.tasksByDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
                contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7", fontSize: 12 }}
                formatter={(value) => [`${Number(value ?? 0)}`, "Task blocks"]}
              />
              <Bar dataKey="tasks" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  );
}
