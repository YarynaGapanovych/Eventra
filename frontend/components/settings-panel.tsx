"use client";

import { GoogleCalendarSyncSection } from "@/components/google-calendar-sync-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  durationChoices,
  getAppSettingsPlaceholder,
  getDefaultTimezone,
  listTimezones,
  loadAppSettings,
  normalizeSettingsPartial,
  saveAppSettings,
  SETTINGS_CHANGED_EVENT,
  type AppSettings,
} from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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

function emitSettingsSaved(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppSettings>(SETTINGS_CHANGED_EVENT, { detail: settings }),
  );
}

export function SettingsPanel() {
  const zones = useMemo(() => listTimezones(), []);
  const [savedPulse, setSavedPulse] = useState(false);

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
  const timezone = useWatch({ control: form.control, name: "timezone" });
  const defaultEventDurationMinutes = useWatch({
    control: form.control,
    name: "defaultEventDurationMinutes",
  });

  useLayoutEffect(() => {
    reset(loadAppSettings());
  }, [reset]);

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

  function onSubmit(values: SettingsFormValues) {
    const normalized = normalizeSettingsPartial(values);
    saveAppSettings(normalized);
    reset(normalized);
    emitSettingsSaved(normalized);
    setSavedPulse(true);
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
              className="font-mono text-sm"
              placeholder={getDefaultTimezone()}
              aria-invalid={!!formState.errors.timezone}
              {...register("timezone")}
            />
            {formState.errors.timezone ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {formState.errors.timezone.message}
              </p>
            ) : null}
            <datalist id="iana-timezones">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
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
              aria-invalid={!!formState.errors.defaultEventDurationMinutes}
              className={cn(
                "flex h-10 w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-none outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
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

        <GoogleCalendarSyncSection />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={invalidRange}>
            Save settings
          </Button>
          {savedPulse ? (
            <span className="text-sm text-teal-700 dark:text-teal-400">
              Saved.
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
