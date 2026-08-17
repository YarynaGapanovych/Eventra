"use client";

import { Button } from "@/components/ui/button";
import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarStatus,
  GOOGLE_CALENDAR_SYNC_CHANGED_EVENT,
  googleCalendarDefaultState,
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
  const [state, setState] = useState<GoogleCalendarSyncState>(
    googleCalendarDefaultState,
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setState(googleCalendarDefaultState);
      setLoading(false);
      return;
    }
    try {
      const next = await fetchGoogleCalendarStatus(token);
      setState(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load calendar status.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const onChanged = () => {
      void refresh();
    };
    void refresh();
    window.addEventListener(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT, onChanged);
    return () =>
      window.removeEventListener(GOOGLE_CALENDAR_SYNC_CHANGED_EVENT, onChanged);
  }, [refresh]);

  async function handleConnectOrSync() {
    setError(null);
    if (!token) {
      setError("Sign in to connect Google Calendar.");
      return;
    }
    if (!state.connected) {
      try {
        await startGoogleCalendarConnect(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connect failed.");
      }
      return;
    }
    setSyncing(true);
    try {
      await syncGoogleCalendar(token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    if (!token) return;
    setSyncing(true);
    try {
      await disconnectGoogleCalendar(token);
      setState(googleCalendarDefaultState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setSyncing(false);
    }
  }

  const lastSyncedLabel = formatWhen(state.lastSyncedAt);
  const busy = loading || syncing;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
        Google Calendar
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Connect your Google account to import events from your primary Google
        Calendar into Eventra.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 rounded-xl border-zinc-300 bg-white text-base text-zinc-800 shadow-sm hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          disabled={busy}
          onClick={() => void handleConnectOrSync()}
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
            disabled={busy}
            onClick={() => void handleDisconnect()}
          >
            Disconnect
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Loading connection status…
        </p>
      ) : state.connected ? (
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
