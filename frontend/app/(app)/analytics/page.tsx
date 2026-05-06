import { fetchTasks, type ApiTask } from "@/lib/tasks-api";
import dayjs from "dayjs";

function scheduledTasks(tasks: ApiTask[]) {
  return tasks.filter((t) => t.scheduled);
}

/** Total duration of scheduled tasks (ms), only positive spans. */
function totalScheduledDurationMs(tasks: ApiTask[]) {
  let sum = 0;
  for (const t of tasks) {
    const a = dayjs(t.startDate).valueOf();
    const b = dayjs(t.endDate).valueOf();
    if (b > a) sum += b - a;
  }
  return sum;
}

/**
 * Inclusive calendar days from earliest start to latest end among scheduled tasks.
 * At least 1 day when there is at least one scheduled task.
 */
function schedulerWindowDayCount(tasks: ApiTask[]) {
  if (tasks.length === 0) return 0;
  let minD = dayjs(tasks[0].startDate).startOf("day");
  let maxD = dayjs(tasks[0].endDate).startOf("day");
  for (const t of tasks) {
    const s = dayjs(t.startDate).startOf("day");
    const e = dayjs(t.endDate).startOf("day");
    if (s.isBefore(minD)) minD = s;
    if (e.isAfter(maxD)) maxD = e;
  }
  return maxD.diff(minD, "day") + 1;
}

/**
 * How "full" the scheduler is: scheduled work hours vs 24h × days in the span of all events.
 * Capped at 100%.
 */
function schedulerBusyPercent(tasks: ApiTask[]) {
  const scheduled = scheduledTasks(tasks);
  if (scheduled.length === 0) return 0;
  const hours = totalScheduledDurationMs(scheduled) / (1000 * 60 * 60);
  const days = schedulerWindowDayCount(scheduled);
  const capacityHours = Math.max(1, days) * 24;
  return Math.min(100, Math.round((hours / capacityHours) * 100));
}

/** Per calendar day (local), count scheduled tasks that overlap that day. */
function dayOverlapCounts(tasks: ApiTask[]) {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    let cur = dayjs(t.startDate).startOf("day");
    const last = dayjs(t.endDate).startOf("day");
    while (!cur.isAfter(last)) {
      const key = cur.format("YYYY-MM-DD");
      counts.set(key, (counts.get(key) ?? 0) + 1);
      cur = cur.add(1, "day");
    }
  }
  return counts;
}

function busiestDay(tasks: ApiTask[]) {
  const scheduled = scheduledTasks(tasks);
  if (scheduled.length === 0) {
    return { label: null as string | null, count: 0 };
  }
  const counts = dayOverlapCounts(scheduled);
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      bestKey = key;
    }
  }
  if (!bestKey) return { label: null, count: 0 };
  const label = dayjs(bestKey).format("dddd, MMM D, YYYY");
  return { label, count: bestCount };
}

function aggregateByStatus(tasks: ApiTask[]) {
  const map = new Map<string, number>();
  for (const t of tasks) {
    map.set(t.progressStatus, (map.get(t.progressStatus) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function humanizeStatus(status: string) {
  return status.replace(/_/g, " ");
}

export default async function AnalyticsPage() {
  let tasks: ApiTask[] = [];
  let loadError: string | null = null;

  try {
    tasks = await fetchTasks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load tasks.";
  }

  const events = scheduledTasks(tasks).length;
  const busyPct = schedulerBusyPercent(tasks);
  const busiest = busiestDay(tasks);
  const byStatus = aggregateByStatus(tasks);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Scheduler insights from calendar-backed tasks (frontend-only calculations).
        </p>
      </header>

      {loadError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {loadError}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Events on calendar
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {events}
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Scheduled tasks counted as calendar events ({tasks.length} tasks
                total).
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Scheduler load
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                {busyPct}%
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Scheduled hours vs 24h × days spanned by those events—how dense
                the calendar window is.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-teal-500/90 transition-[width] duration-300 dark:bg-teal-600/90"
                  style={{ width: `${busyPct}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Busiest day
              </p>
              {busiest.label ? (
                <>
                  <p className="mt-2 text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                    {busiest.label}
                  </p>
                  <p className="mt-2 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                    {busiest.count} overlapping event
                    {busiest.count === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No scheduled events yet.
                </p>
              )}
            </div>
          </div>

          <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              By progress status
            </h2>
            {byStatus.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                No data yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {byStatus.map(([status, count]) => {
                  const pct =
                    tasks.length > 0
                      ? Math.round((count / tasks.length) * 100)
                      : 0;
                  return (
                    <li key={status}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="capitalize text-zinc-800 dark:text-zinc-200">
                          {humanizeStatus(status)}
                        </span>
                        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                          {count}{" "}
                          <span className="text-zinc-400">({pct}%)</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-teal-500/90 dark:bg-teal-600/90"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
