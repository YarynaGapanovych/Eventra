"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useDisconnectGoogleCalendarMutation,
  useGoogleCalendarStatusQuery,
  useStartGoogleCalendarConnectMutation,
  useSyncGoogleCalendarMutation,
  useUpdateGoogleCalendarSyncWindowMutation,
} from "@/hooks/use-google-calendar";
import { getStoredAuth } from "@/lib/auth-api";
import {
  DEFAULT_SYNC_DAYS_BACK,
  DEFAULT_SYNC_DAYS_FORWARD,
  googleCalendarDefaultState,
  SYNC_DAYS_BACK_PRESETS,
  SYNC_DAYS_FORWARD_PRESETS,
} from "@/lib/google-calendar-sync";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { CalendarSync, CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

function formatOauthError(message: string | null): string {
  if (!message) return "Google Calendar connection was cancelled or failed.";
  if (message === "invalid_oauth_state") {
    return "Connection expired. Click Connect Google Calendar and try again.";
  }
  if (message === "missing_authorization_code") {
    return "Google did not return an authorization code. Try connecting again.";
  }
  return message.replace(/_/g, " ");
}

function resolveToken(storeToken: string | null): string | null {
  return storeToken ?? getStoredAuth()?.token ?? null;
}

const selectClassName = cn(
  "flex h-10 w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-none outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "dark:border-zinc-700 dark:bg-zinc-950",
);

export function GoogleCalendarSyncSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeToken = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = resolveToken(storeToken);
  const signedIn = Boolean(token);
  const authPending = !hydrated;

  const statusQuery = useGoogleCalendarStatusQuery();
  const connectMutation = useStartGoogleCalendarConnectMutation();
  const disconnectMutation = useDisconnectGoogleCalendarMutation();
  const syncMutation = useSyncGoogleCalendarMutation();
  const windowMutation = useUpdateGoogleCalendarSyncWindowMutation();

  const [error, setError] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const state = signedIn
    ? (statusQuery.data ?? googleCalendarDefaultState)
    : googleCalendarDefaultState;
  const loading = authPending || (signedIn && statusQuery.isPending);
  const syncing =
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    syncMutation.isPending ||
    windowMutation.isPending;
  const busy = loading || syncing;
  const statusError =
    statusQuery.error instanceof Error
      ? statusQuery.error.message
      : statusQuery.error
        ? "Could not load calendar status."
        : null;
  const displayError = error ?? statusError;

  useEffect(() => {
    if (!displayError) return;
    toast.error(displayError, { id: "google-calendar-error" });
  }, [displayError]);

  const refetchStatus = statusQuery.refetch;
  const syncCalendar = syncMutation.mutateAsync;

  useEffect(() => {
    if (!hydrated) return;

    const oauthStatus = searchParams.get("google_calendar");
    if (!oauthStatus) return;

    const oauthMessage = searchParams.get("message");

    async function handleOauthReturn() {
      if (oauthStatus === "error") {
        setOauthNotice(null);
        setError(formatOauthError(oauthMessage));
        return;
      }

      if (oauthStatus === "connected") {
        setOauthNotice(null);
        if (!resolveToken(useAuthStore.getState().token)) {
          setError("Sign in to Eventra, then connect Google Calendar again.");
          return;
        }

        const next = await refetchStatus();
        if (next.data?.connected) {
          setOauthNotice("Google Calendar connected successfully.");
          setError(null);
          try {
            await syncCalendar();
          } catch (err) {
            setError(
              err instanceof Error
                ? `Connected, but events could not be imported: ${err.message}`
                : "Connected, but events could not be imported. Try Sync now.",
            );
          }
        } else {
          setError(
            "Google sign-in finished, but Eventra did not save the connection. Click Connect Google Calendar to try again.",
          );
        }
      }
    }

    void handleOauthReturn();

    const next = new URLSearchParams(searchParams.toString());
    next.delete("google_calendar");
    next.delete("message");
    const qs = next.toString();
    router.replace(qs ? `/settings?${qs}` : "/settings", { scroll: false });
  }, [hydrated, refetchStatus, router, searchParams, syncCalendar]);

  async function handleConnect() {
    setError(null);
    setOauthNotice(null);
    if (!resolveToken(useAuthStore.getState().token)) {
      setError("Sign in to Eventra before connecting Google Calendar.");
      return;
    }
    try {
      await connectMutation.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
    }
  }

  async function handleSync() {
    setError(null);
    setOauthNotice(null);
    if (!resolveToken(useAuthStore.getState().token)) {
      setError("Sign in to sync Google Calendar.");
      return;
    }
    try {
      await syncMutation.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    }
  }

  async function handleDisconnect() {
    setError(null);
    setOauthNotice(null);
    if (!resolveToken(useAuthStore.getState().token)) return;
    try {
      await disconnectMutation.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    }
  }

  async function handleWindowChange(next: {
    syncDaysBack: number;
    syncDaysForward: number;
  }) {
    if (
      next.syncDaysBack === state.syncDaysBack &&
      next.syncDaysForward === state.syncDaysForward
    ) {
      return;
    }

    if (!state.connected) return;

    if (!resolveToken(useAuthStore.getState().token)) {
      setError("Sign in to change the Google Calendar sync window.");
      return;
    }

    setError(null);
    setOauthNotice(null);
    try {
      await windowMutation.mutateAsync(next);
      await syncMutation.mutateAsync();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the sync window.",
      );
    }
  }

  const lastSyncedLabel = formatWhen(state.lastSyncedAt);
  const connectedAtLabel = formatWhen(state.connectedAt);

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
        Google Calendar
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {state.connected
          ? "Your Google Calendar is linked to Eventra. Sync to import events, or reconnect to refresh access."
          : "Connect your Google account to import events from your primary Google Calendar into Eventra."}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="google-sync-days-back">Past</Label>
          <select
            id="google-sync-days-back"
            className={selectClassName}
            disabled={busy || !state.connected || !signedIn}
            value={state.syncDaysBack}
            onChange={(e) =>
              void handleWindowChange({
                syncDaysBack: Number(e.target.value) || DEFAULT_SYNC_DAYS_BACK,
                syncDaysForward: state.syncDaysForward,
              })
            }
          >
            {SYNC_DAYS_BACK_PRESETS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="google-sync-days-forward">Upcoming</Label>
          <select
            id="google-sync-days-forward"
            className={selectClassName}
            disabled={busy || !state.connected || !signedIn}
            value={state.syncDaysForward}
            onChange={(e) =>
              void handleWindowChange({
                syncDaysBack: state.syncDaysBack,
                syncDaysForward:
                  Number(e.target.value) || DEFAULT_SYNC_DAYS_FORWARD,
              })
            }
          >
            {SYNC_DAYS_FORWARD_PRESETS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Each sync imports events from your primary Google Calendar from{" "}
        {state.syncDaysBack} days ago through {state.syncDaysForward} days
        ahead.
      </p>

      {!signedIn && !loading && !authPending ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          Sign in to Eventra first — Google Calendar linking is saved to your
          account.{" "}
          <Link href="/" className="font-medium underline underline-offset-2">
            Go to sign in
          </Link>
        </p>
      ) : null}

      {authPending || loading ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading connection status…
        </p>
      ) : state.connected ? (
        <>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-teal-200/80 bg-teal-50/80 px-4 py-3 dark:border-teal-900/60 dark:bg-teal-950/30">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-teal-600 dark:text-teal-400"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                Google Calendar is connected
              </p>
              {connectedAtLabel ? (
                <p className="mt-0.5 text-sm text-teal-700/80 dark:text-teal-400/80">
                  Connected {connectedAtLabel}
                  {lastSyncedLabel
                    ? ` · Last synced ${lastSyncedLabel}`
                    : " · Not synced yet"}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2 rounded-xl border-zinc-300 bg-white text-base text-zinc-800 shadow-sm hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              disabled={busy}
              onClick={() => void handleSync()}
            >
              {syncing ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin"
                  aria-hidden
                />
              ) : (
                <CalendarSync className="size-4 shrink-0" aria-hidden />
              )}
              Sync now
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2 rounded-xl sm:w-auto"
              disabled={busy}
              onClick={() => void handleConnect()}
            >
              <Image
                src="/icons8-google.svg"
                alt=""
                width={18}
                height={18}
                aria-hidden
              />
              Reconnect
            </Button>

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
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 rounded-xl border-zinc-300 bg-white text-base text-zinc-800 shadow-sm hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            disabled={busy || !signedIn}
            onClick={() => void handleConnect()}
          >
            <Image
              src="/icons8-google.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden
            />
            Connect Google Calendar
          </Button>
        </div>
      )}

      {oauthNotice ? (
        <p className="mt-2 text-sm text-teal-700 dark:text-teal-400">
          {oauthNotice}
        </p>
      ) : null}
    </section>
  );
}
