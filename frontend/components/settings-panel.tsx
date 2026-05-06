"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

function emitSettingsSaved(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppSettings>(SETTINGS_CHANGED_EVENT, { detail: settings }),
  );
}

export function SettingsPanel() {
  const zones = useMemo(() => listTimezones(), []);

  const [form, setForm] = useState<AppSettings>(getAppSettingsPlaceholder);
  const [savedPulse, setSavedPulse] = useState(false);

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm(loadAppSettings());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const durationOpts = useMemo(() => {
    const base = [...durationChoices()];
    if (!base.includes(form.defaultEventDurationMinutes)) {
      base.push(form.defaultEventDurationMinutes);
    }
    return [...new Set(base)].sort((a, b) => a - b);
  }, [form.defaultEventDurationMinutes]);

  useEffect(() => {
    if (!savedPulse) return;
    const t = window.setTimeout(() => setSavedPulse(false), 2000);
    return () => window.clearTimeout(t);
  }, [savedPulse]);

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => normalizeSettingsPartial({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeSettingsPartial(form);

    const [sh, sm] = normalized.workdayStart.split(":").map(Number);
    const [eh, em] = normalized.workdayEnd.split(":").map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    if (endM <= startM) {
      return;
    }

    saveAppSettings(normalized);
    setForm(normalized);
    emitSettingsSaved(normalized);
    setSavedPulse(true);
  }

  const invalidRange =
    (() => {
      const normalized = normalizeSettingsPartial(form);
      const [sh, sm] = normalized.workdayStart.split(":").map(Number);
      const [eh, em] = normalized.workdayEnd.split(":").map(Number);
      return eh * 60 + em <= sh * 60 + sm;
    })();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Scheduling preferences are stored in this browser ({`localStorage`}
          ).
        </p>
      </header>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Working hours
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Typical availability window ({form.timezone}); used as reference for
            planning.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-day-start">Day starts</Label>
              <Input
                id="settings-day-start"
                type="time"
                value={form.workdayStart}
                onChange={(e) => patch("workdayStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-day-end">Day ends</Label>
              <Input
                id="settings-day-end"
                type="time"
                value={form.workdayEnd}
                onChange={(e) => patch("workdayEnd", e.target.value)}
              />
            </div>
          </div>
          {invalidRange ? (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">
              End time must be after start time.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Time zone
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            IANA identifier. Choose from the list or type to filter in your
            browser.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="settings-tz">Region</Label>
            <Input
              id="settings-tz"
              list="iana-timezones"
              value={form.timezone}
              onChange={(e) => patch("timezone", e.target.value)}
              autoComplete="off"
              className="font-mono text-sm"
              placeholder={getDefaultTimezone()}
            />
            <datalist id="iana-timezones">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Default event duration
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            New calendar events default to this length when created in Eventra.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="settings-duration">Length</Label>
            <select
              id="settings-duration"
              value={form.defaultEventDurationMinutes}
              onChange={(e) =>
                patch(
                  "defaultEventDurationMinutes",
                  Number.parseInt(e.target.value, 10),
                )
              }
              className={cn(
                "flex h-10 w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-none outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "dark:border-zinc-700 dark:bg-zinc-950",
              )}
            >
              {durationOpts.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                  {m === 60 ? " (1 hr)" : m === 120 ? " (2 hr)" : ""}
                </option>
              ))}
            </select>
          </div>
        </section>

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
