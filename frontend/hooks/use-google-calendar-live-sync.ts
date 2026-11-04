"use client";

import { useGoogleCalendarStatusQuery } from "@/hooks/use-google-calendar";
import { graphqlRequest } from "@/lib/graphql";
import { SYNC_GOOGLE_CALENDAR_MUTATION } from "@/lib/graphql/mutations";
import type { GoogleCalendarSyncState } from "@/lib/google-calendar-sync";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

const POLL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;

let lastLiveSyncAt = 0;
let liveSyncInFlight = false;

type SyncGoogleCalendarResult = {
  ok?: boolean;
  syncedAt?: string;
  imported?: number;
  changed?: boolean;
};

export function useGoogleCalendarLiveSync() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const statusQuery = useGoogleCalendarStatusQuery();
  const connected = statusQuery.data?.connected === true;
  const needsReconnect = statusQuery.data?.needsReconnect === true;

  const run = useCallback(async () => {
    if (!hydrated || !token || !connected || needsReconnect) return;
    if (document.visibilityState !== "visible") return;
    if (liveSyncInFlight) return;
    if (Date.now() - lastLiveSyncAt < MIN_INTERVAL_MS) return;

    liveSyncInFlight = true;
    lastLiveSyncAt = Date.now();
    try {
      const data = await graphqlRequest<{
        syncGoogleCalendar: SyncGoogleCalendarResult;
      }>(SYNC_GOOGLE_CALENDAR_MUTATION, { incremental: true });
      const result = data.syncGoogleCalendar;

      if (result.changed) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.googleCalendarStatus,
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        void queryClient.invalidateQueries({ queryKey: queryKeys.events });
        return;
      }

      if (result.syncedAt) {
        queryClient.setQueryData<GoogleCalendarSyncState>(
          [...queryKeys.googleCalendarStatus, token],
          (prev) =>
            prev
              ? { ...prev, lastSyncedAt: result.syncedAt ?? prev.lastSyncedAt }
              : prev,
        );
      }
    } catch {
      // Background polls stay silent; refresh the status so Settings can show
      // a "reconnect needed" warning if Google rejected the stored access.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.googleCalendarStatus,
      });
    } finally {
      liveSyncInFlight = false;
    }
  }, [connected, hydrated, needsReconnect, queryClient, token]);

  useEffect(() => {
    if (!hydrated || !token || !connected || needsReconnect) return;

    void run();

    const interval = window.setInterval(() => {
      void run();
    }, POLL_MS);

    function onFocus() {
      void run();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void run();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connected, hydrated, needsReconnect, run, token]);
}

export function GoogleCalendarLiveSync() {
  useGoogleCalendarLiveSync();
  return null;
}
