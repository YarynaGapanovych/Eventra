"use client";

import { Button } from "@/components/ui/button";
import {
  disconnectGoogleCalendar,
  GOOGLE_CALENDAR_SYNC_CHANGED_EVENT,
  loadGoogleCalendarSyncState,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
  type GoogleCalendarSyncState,
} from "@/lib/google-calendar-sync";
import { useAuthStore } from "@/stores/auth-store";
import { CalendarSync, Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function GoogleCalendarSyncSection() {
  const token = useAuthStore((s) => s.token);
  const [state, setState] = useState<GoogleCalendarSyncState>(() =>
    loadGoogleCalendarSyncState(),
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setState(loadGoogleCalendarSyncState());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT, refresh);
  }, [refresh]);

  async function handleSync() {
    setError(null);
    if (!token) {
      setError("Sign in to sync Google Calendar.");
      return;
    }
    if (!state.connected) {
      startGoogleCalendarConnect();
      return;
    }
    setSyncing(true);
    try {
      await syncGoogleCalendar(token);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnect() {
    setError(null);
    disconnectGoogleCalendar();
    refresh();
  }

  const lastSyncedLabel = formatWhen(state.lastSyncedAt);

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
        Google Calendar
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Connect your Google account to sync events between Eventra and Google
        Calendar.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 rounded-xl border-zinc-300 bg-white text-base text-zinc-800 shadow-sm hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          disabled={syncing}
          onClick={() => void handleSync()}
        >
          {syncing ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Image
              src="/icons8-google.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden
            />
          )}
          {state.connected
            ? "Sync with Google Calendar"
            : "Connect Google Calendar"}
        </Button>

        {state.connected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-zinc-600 dark:text-zinc-400"
            disabled={syncing}
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        ) : null}
      </div>

      {state.connected ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-teal-700 dark:text-teal-400">
          <CalendarSync className="size-4 shrink-0" aria-hidden />
          Connected
          {lastSyncedLabel ? (
            <span className="text-zinc-500 dark:text-zinc-400">
              · Last synced {lastSyncedLabel}
            </span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              · Not synced yet
            </span>
          )}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </section>
  );
}
