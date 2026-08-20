"use client";

import { GoogleCalendarSyncSection } from "@/components/google-calendar-sync-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useUpdateUserSettingsMutation,
  useUserSettingsQuery,
} from "@/hooks/use-user-settings";
import {
  durationChoices,
  getAppSettingsPlaceholder,
  listTimezones,
  normalizeSettingsPartial,
  type AppSettings,
} from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod/v3";

const TIME_HM = /^(?:[01]?[0-9]|2[0-3]):[0-5][0-9]$/;

function minutesFromHm(value: string): number | null {
  const trimmed = value.trim();
  if (!TIME_HM.test(trimmed)) return null;
  const [h, m] = trimmed.split(":").map(Number);
  return h * 60 + m;
}

const timeHmSchema = z.string().regex(TIME_HM, "Use 24-hour time (HH:mm).");

const settingsFormSchema = z
  .object({
    workdayStart: timeHmSchema,
    workdayEnd: timeHmSchema,
    timezone: z.string().trim().min(1, "Time zone is required."),
    defaultEventDurationMinutes: z
      .number()
      .int("Duration must be a whole number of minutes.")
      .min(5, "At least 5 minutes.")
      .max(24 * 60, "At most 24 hours."),
    showPastDoneTaskEvents: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const startM = minutesFromHm(data.workdayStart);
    const endM = minutesFromHm(data.workdayEnd);
    if (startM == null || endM == null) return;
    if (endM <= startM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workdayEnd"],
        message: "End time must be after start time.",
      });
    }
  });

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function SettingsPanel() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const signedIn = Boolean(token);
  const settingsQuery = useUserSettingsQuery();
  const updateMutation = useUpdateUserSettingsMutation();

  const [zones, setZones] = useState<string[]>([]);
  const [savedPulse, setSavedPulse] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: getAppSettingsPlaceholder(),
    mode: "onChange",
  });

  const { register, handleSubmit, reset, formState } = form;

  const workdayStart = useWatch({
    control: form.control,
    name: "workdayStart",
  });
  const workdayEnd = useWatch({ control: form.control, name: "workdayEnd" });
  const defaultEventDurationMinutes = useWatch({
    control: form.control,
    name: "defaultEventDurationMinutes",
  });

  useEffect(() => {
    if (settingsQuery.data) {
      reset(settingsQuery.data);
    }
  }, [settingsQuery.data, reset]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- IANA list is client-only */
    setZones(listTimezones());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const durationOpts = useMemo(() => {
    const base = [...durationChoices()];
    const cur = defaultEventDurationMinutes;
    if (
      typeof cur === "number" &&
      Number.isFinite(cur) &&
      !base.includes(cur)
    ) {
      base.push(cur);
    }
    return [...new Set(base)].sort((a, b) => a - b);
  }, [defaultEventDurationMinutes]);

  useEffect(() => {
    if (!savedPulse) return;
    const t = window.setTimeout(() => setSavedPulse(false), 2000);
    return () => window.clearTimeout(t);
  }, [savedPulse]);

  const invalidRange = (() => {
    const sm = workdayStart != null ? minutesFromHm(workdayStart) : null;
    const em = workdayEnd != null ? minutesFromHm(workdayEnd) : null;
    if (sm == null || em == null) return false;
    return em <= sm;
  })();

  const loading = !hydrated || (signedIn && settingsQuery.isPending);
  const fieldsDisabled = !signedIn || loading || updateMutation.isPending;
  const loadError =
    settingsQuery.error instanceof Error
      ? settingsQuery.error.message
      : settingsQuery.error
        ? "Could not load settings."
        : null;
  const displayError = saveError ?? loadError;

  async function onSubmit(values: SettingsFormValues) {
    if (!signedIn) return;
    const normalized = normalizeSettingsPartial(values);
    setSaveError(null);
    try {
      const saved: AppSettings = await updateMutation.mutateAsync(normalized);
      reset(saved);
      setSavedPulse(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save settings.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
            Working hours
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-day-start">Day starts</Label>
              <Input
                id="settings-day-start"
                type="time"
                step={60}
                disabled={fieldsDisabled}
                aria-invalid={!!formState.errors.workdayStart}
                className="h-11 font-mono text-base tabular-nums [&::-webkit-datetime-edit]:text-start"
                {...register("workdayStart")}
              />
              {formState.errors.workdayStart ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {formState.errors.workdayStart.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-day-end">Day ends</Label>
              <Input
                id="settings-day-end"
                type="time"
                step={60}
                disabled={fieldsDisabled}
                aria-invalid={!!formState.errors.workdayEnd}
                className="h-11 font-mono text-base tabular-nums [&::-webkit-datetime-edit]:text-start"
                {...register("workdayEnd")}
              />
              {formState.errors.workdayEnd ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {formState.errors.workdayEnd.message}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
            Time zone
          </h2>

          <div className="mt-4 space-y-2">
            <Label htmlFor="settings-tz">Region</Label>
            <Input
              id="settings-tz"
              list="iana-timezones"
              autoComplete="off"
              disabled={fieldsDisabled}
              className="font-mono text-sm"
              placeholder="e.g. Europe/Warsaw"
              aria-invalid={!!formState.errors.timezone}
              {...register("timezone")}
            />
            {formState.errors.timezone ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {formState.errors.timezone.message}
              </p>
            ) : null}
            {zones.length > 0 ? (
              <datalist id="iana-timezones">
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
            Default event duration
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            New calendar events default to this length when created in Eventra.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="settings-duration">Length</Label>
            <select
              id="settings-duration"
              disabled={fieldsDisabled}
              aria-invalid={!!formState.errors.defaultEventDurationMinutes}
              className={cn(
                "flex h-10 w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-none outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:border-zinc-700 dark:bg-zinc-950",
                formState.errors.defaultEventDurationMinutes &&
                  "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
              )}
              {...register("defaultEventDurationMinutes", {
                valueAsNumber: true,
              })}
            >
              {durationOpts.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                  {m === 60 ? " (1 hr)" : m === 120 ? " (2 hr)" : ""}
                </option>
              ))}
            </select>
            {formState.errors.defaultEventDurationMinutes ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {formState.errors.defaultEventDurationMinutes.message}
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
            Completed tasks on the calendar
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Future blocks of a done task are always removed so the slot is free.
            Choose whether past blocks stay visible.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-zinc-300 text-teal-600 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={fieldsDisabled}
              {...register("showPastDoneTaskEvents")}
            />
            <span>
              Show past calendar blocks for completed tasks
            </span>
          </label>
        </section>

        <Suspense
          fallback={
            <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
                Google Calendar
              </h2>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Loading connection status…
              </p>
            </section>
          }
        >
          <GoogleCalendarSyncSection />
        </Suspense>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={
              invalidRange ||
              !signedIn ||
              loading ||
              updateMutation.isPending
            }
          >
            {updateMutation.isPending ? "Saving…" : "Save settings"}
          </Button>
          {savedPulse ? (
            <span className="text-sm text-teal-700 dark:text-teal-400">
              Saved.
            </span>
          ) : null}
          {loading ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading settings…
            </span>
          ) : null}
        </div>

        {!signedIn && hydrated ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Sign in to Eventra to save settings to your account.{" "}
            <Link href="/" className="font-medium underline underline-offset-2">
              Go to sign in
            </Link>
          </p>
        ) : null}

        {displayError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {displayError}
          </p>
        ) : null}
      </form>
    </div>
  );
}
