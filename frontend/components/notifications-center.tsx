"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  loadReminders,
  reminderUid,
  saveReminders,
  type StoredNotification,
  type StoredReminder,
  NOTIF_KEY,
} from "@/lib/reminder-storage";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Bell, Check, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

dayjs.extend(relativeTime);

function readInitialNotifications(): StoredNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_KEY);
    if (!raw) {
      const seeded = seedNotifications();
      window.localStorage.setItem(NOTIF_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as StoredNotification[];
    if (!Array.isArray(parsed)) {
      const seeded = seedNotifications();
      window.localStorage.setItem(NOTIF_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedNotifications();
    window.localStorage.setItem(NOTIF_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function seedNotifications(): StoredNotification[] {
  return [
    {
      id: "seed-welcome",
      title: "Welcome to Eventra",
      body: "Open this panel anytime for reminders and updates.",
      createdAt: new Date().toISOString(),
      read: false,
      kind: "system",
    },
  ];
}

function saveNotifs(items: StoredNotification[]) {
  window.localStorage.setItem(NOTIF_KEY, JSON.stringify(items));
}

type Tab = "notifications" | "reminders";

export function NotificationsCenter({ className }: { className?: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("notifications");
  const [notifications, setNotifications] = useState<StoredNotification[]>(
    () => [],
  );
  const [reminders, setReminders] = useState<StoredReminder[]>([]);
  const [remTitle, setRemTitle] = useState("");
  const [remWhen, setRemWhen] = useState(() =>
    dayjs().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
  );

  const titleId = useId();

  /* hydrate inbox from localStorage (client-only source) */
  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setNotifications(readInitialNotifications());
    setReminders(loadReminders());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const flushDueRemindersIntoInbox = useCallback((snapshot: StoredReminder[]) => {
    const nowTs = Date.now();
    const due = snapshot.filter((r) => new Date(r.remindAt).getTime() <= nowTs);
    if (due.length === 0) return;

    const nextR = snapshot.filter((r) => new Date(r.remindAt).getTime() > nowTs);
    saveReminders(nextR);
    setReminders(nextR);

    const extras: StoredNotification[] = due.map((r) => ({
      id: reminderUid(),
      title: "Reminder",
      body: r.title,
      createdAt: new Date().toISOString(),
      read: false,
      kind: "reminder",
    }));

    setNotifications((prevN) => {
      const merged = [...extras, ...prevN];
      saveNotifs(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    const tick = () => flushDueRemindersIntoInbox(loadReminders());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [flushDueRemindersIntoInbox]);

  const handleToggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    flushDueRemindersIntoInbox(reminders);
    setOpen(true);
  }, [open, reminders, flushDueRemindersIntoInbox]);

  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const persistNotifs = useCallback((next: StoredNotification[]) => {
    setNotifications(next);
    saveNotifs(next);
  }, []);

  const persistReminders = useCallback((next: StoredReminder[]) => {
    setReminders(next);
    saveReminders(next);
  }, []);

  const markAllRead = () => {
    persistNotifs(notifications.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    persistNotifs(notifications.filter((n) => n.id !== id));
  };

  const toggleRead = (id: string) => {
    persistNotifs(
      notifications.map((n) =>
        n.id === id ? { ...n, read: !n.read } : n,
      ),
    );
  };

  const addReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const t = remTitle.trim();
    if (!t) return;
    const at = dayjs(remWhen);
    if (!at.isValid()) return;
    persistReminders([
      ...reminders,
      { id: reminderUid(), title: t, remindAt: at.toISOString() },
    ]);
    setRemTitle("");
    setRemWhen(dayjs().add(1, "hour").format("YYYY-MM-DDTHH:mm"));
  };

  const removeReminder = (id: string) => {
    persistReminders(reminders.filter((r) => r.id !== id));
  };

  const sortedReminders = useMemo(
    () =>
      [...reminders].sort(
        (a, b) =>
          new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
      ),
    [reminders],
  );

  const sortedNotifs = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notifications],
  );

  return (
    <div className={cn("relative", className)}>
      <div ref={buttonRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Notifications and reminders"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? titleId : undefined}
          className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={handleToggle}
        >
          <span className="relative inline-flex">
            <Bell className="size-[22px]" aria-hidden />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-0.5 text-[10px] font-semibold text-white dark:bg-teal-500">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </span>
        </Button>
      </div>

      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-[60] mt-2 flex w-[min(calc(100vw-2rem),22rem)] max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h2
              id={titleId}
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Inbox
            </h2>
            <div className="flex items-center gap-1">
              {unread > 0 && tab === "notifications" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-xs"
                  onClick={markAllRead}
                >
                  Mark all read
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div
            className="flex border-b border-zinc-200 p-1 dark:border-zinc-800"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "notifications"}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                tab === "notifications"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
              onClick={() => setTab("notifications")}
            >
              Notifications
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "reminders"}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                tab === "reminders"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
              onClick={() => setTab("reminders")}
            >
              Reminders
            </button>
          </div>

          {tab === "notifications" ? (
            <ul className="flex-1 overflow-y-auto p-2">
              {sortedNotifs.length === 0 ? (
                <li className="px-2 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No notifications yet.
                </li>
              ) : (
                sortedNotifs.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "mb-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800/80",
                      !n.read && "border-teal-200/80 bg-teal-50/40 dark:border-teal-900/40 dark:bg-teal-950/25",
                    )}
                  >
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {n.title}
                        </p>
                        {n.body ? (
                          <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                          {dayjs(n.createdAt).fromNow()}
                          {n.kind === "reminder" ? " · Reminder" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={n.read ? "Mark unread" : "Mark read"}
                          onClick={() => toggleRead(n.id)}
                        >
                          <Check
                            className={cn("size-3.5", n.read && "opacity-40")}
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Dismiss"
                          onClick={() => dismiss(n.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <form
                className="shrink-0 space-y-2 border-b border-zinc-200 p-3 dark:border-zinc-800"
                onSubmit={addReminder}
              >
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  New reminder
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="rem-title" className="text-xs">
                    Title
                  </Label>
                  <Input
                    id="rem-title"
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    placeholder="What should we remind you about?"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rem-when" className="text-xs">
                    When
                  </Label>
                  <Input
                    id="rem-when"
                    type="datetime-local"
                    value={remWhen}
                    onChange={(e) => setRemWhen(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={!remTitle.trim()}>
                  Save reminder
                </Button>
              </form>
              <ul className="flex-1 overflow-y-auto p-2">
                {sortedReminders.length === 0 ? (
                  <li className="px-2 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No reminders scheduled.
                  </li>
                ) : (
                  sortedReminders.map((r) => {
                    const at = dayjs(r.remindAt);
                    const overdue = at.isBefore(dayjs());
                    return (
                      <li
                        key={r.id}
                        className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800/80"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {r.title}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 text-xs",
                              overdue
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-zinc-500 dark:text-zinc-400",
                            )}
                          >
                            {at.format("MMM D, YYYY h:mm A")}
                            {overdue ? " · Due" : ` · ${at.fromNow()}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remove reminder"
                          onClick={() => removeReminder(r.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
