export const NOTIF_KEY = "eventra.notifications.v1";
export const REMINDER_KEY = "eventra.reminders.v1";
export const ENTITY_REMINDER_PREFIX = "event-reminder:";

export type StoredNotification = {
  id: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  kind: "system" | "reminder";
};

export type StoredReminder = {
  id: string;
  title: string;
  remindAt: string;
};

export function reminderUid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadReminders(): StoredReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMINDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredReminder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReminders(items: StoredReminder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDER_KEY, JSON.stringify(items));
}

export function syncEntityReminders(options: {
  entityId: string;
  title: string;
  startIso: string | null;
  minutesBefore: number[];
}): void {
  if (typeof window === "undefined") return;
  const prefix = `${ENTITY_REMINDER_PREFIX}${options.entityId}:`;
  const kept = loadReminders().filter((item) => !item.id.startsWith(prefix));
  if (!options.startIso || options.minutesBefore.length === 0) {
    saveReminders(kept);
    return;
  }
  const startMs = new Date(options.startIso).getTime();
  if (Number.isNaN(startMs)) {
    saveReminders(kept);
    return;
  }
  const added = options.minutesBefore.map((minutes) => ({
    id: `${prefix}${minutes}`,
    title: options.title,
    remindAt: new Date(startMs - minutes * 60_000).toISOString(),
  }));
  saveReminders([...kept, ...added]);
}
