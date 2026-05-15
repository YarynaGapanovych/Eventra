"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock3,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StatCardData = {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
};

const stats: StatCardData[] = [
  { label: "Scheduled Hours", value: "38.5h", change: "+8% vs last week", positive: true },
  { label: "Completed Tasks", value: "27", change: "+5 tasks", positive: true },
  { label: "Scheduling Conflicts", value: "3", change: "-2 resolved", positive: true },
  { label: "Average Workload", value: "74%", change: "+4%", positive: false },
];

const workloadByDay = [
  { day: "Mon", hours: 6.5 },
  { day: "Tue", hours: 7.2 },
  { day: "Wed", hours: 8.6 },
  { day: "Thu", hours: 6.9 },
  { day: "Fri", hours: 5.8 },
  { day: "Sat", hours: 2.4 },
  { day: "Sun", hours: 1.8 },
];

const completionTrend = [
  { label: "Apr 29", completed: 3 },
  { label: "Apr 30", completed: 4 },
  { label: "May 1", completed: 5 },
  { label: "May 2", completed: 2 },
  { label: "May 3", completed: 6 },
  { label: "May 4", completed: 4 },
  { label: "May 5", completed: 7 },
  { label: "May 6", completed: 5 },
  { label: "May 7", completed: 8 },
];

const timeAllocation = [
  { name: "Meetings", value: 34, color: "#0f766e" },
  { name: "Focus Work", value: 42, color: "#334155" },
  { name: "Admin", value: 14, color: "#64748b" },
  { name: "Personal", value: 10, color: "#94a3b8" },
];

const upcomingDeadlines = [
  { task: "Finalize Q2 roadmap", due: "May 10, 4:00 PM", priority: "High" },
  { task: "Vendor budget review", due: "May 11, 11:30 AM", priority: "Medium" },
  { task: "Sprint retrospective prep", due: "May 12, 9:00 AM", priority: "Low" },
];

const conflicts = [
  { title: "Overlapping meetings", detail: "Tue 10:00-10:45 and 10:30-11:00 overlap." },
  { title: "Overloaded day", detail: "Wednesday is booked 9.1 hours with no buffer." },
];

const quickInsights = [
  "Wednesday is your busiest day with 8.6 scheduled hours.",
  "Meeting time increased by 20% from the previous week.",
  "Tasks completed after 2 PM have the highest completion rate.",
];

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

function StatCard({ label, value, change, positive }: StatCardData) {
  return (
    <article className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {change ? (
        <p
          className={cn(
            "mt-2 text-xs",
            positive ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400",
          )}
        >
          {change}
        </p>
      ) : null}
    </article>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("Last 14 days");
  const [scope, setScope] = useState("Personal");

  const productiveDay = useMemo(
    () =>
      workloadByDay.reduce((best, current) =>
        current.hours > best.hours ? current : best,
      ).day,
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-1">
      <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950/60">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Scheduling performance, workload balance, and productivity insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
            {["Last 7 days", "Last 14 days", "This month"].map((item) => (
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

          <div className="rounded-lg border border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900/70">
            <select
              aria-label="Filter scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="h-8 bg-transparent text-sm text-zinc-700 outline-none dark:text-zinc-200"
            >
              <option>Personal</option>
              <option>Team</option>
            </select>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <SectionCard
            title="Workload Overview"
            subtitle={`Workload by day of week · ${scope} · ${range}`}
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
                    contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7", fontSize: 12 }}
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="#0f766e" maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Task Completion Trend" subtitle="Completed tasks over time">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tickLine={false} axisLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#334155"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1, fill: "#fff" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <SectionCard title="Upcoming Deadlines" subtitle="Priority-focused task reminders">
            <ul className="space-y-3">
              {upcomingDeadlines.map((item) => (
                <li
                  key={item.task}
                  className="rounded-xl border border-zinc-200/80 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.task}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {item.due}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        item.priority === "High" &&
                          "bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300",
                        item.priority === "Medium" &&
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300",
                        item.priority === "Low" &&
                          "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {item.priority}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Scheduling Conflicts" subtitle="Potential issues requiring attention">
            <div className="space-y-3">
              {conflicts.map((item) => (
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
          </SectionCard>

          <SectionCard title="Quick Insights">
            <ul className="space-y-2">
              {quickInsights.map((insight) => (
                <li
                  key={insight}
                  className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300"
                >
                  <p className="inline-flex items-start gap-2">
                    <TrendingUp className="mt-0.5 size-3.5 text-zinc-500 dark:text-zinc-400" aria-hidden />
                    <span>{insight}</span>
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <SectionCard title="Time Allocation" subtitle="Where your week is being spent" className="lg:col-span-7">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={timeAllocation}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={66}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {timeAllocation.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0)}%`, "Allocation"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#e4e4e7", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {timeAllocation.map((entry) => (
              <div key={entry.name} className="rounded-lg border border-zinc-200/80 p-2 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {entry.value}%
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Productivity Summary" subtitle="Key scheduling outcomes" className="lg:col-span-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
              <p className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <CheckCircle2 className="size-4 text-zinc-500" aria-hidden />
                Most productive day
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{productiveDay}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
              <p className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <Clock3 className="size-4 text-zinc-500" aria-hidden />
                Average free time
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">2h 15m / day</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-800">
              <p className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <CalendarClock className="size-4 text-zinc-500" aria-hidden />
                Longest focus session
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">3h 20m (Thu)</p>
            </div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
