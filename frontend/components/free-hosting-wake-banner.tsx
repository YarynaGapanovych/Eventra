"use client";

import {
  FREE_HOSTING_WAKE_MESSAGE,
  useApiWakeNotice,
} from "@/hooks/use-api-wake-notice";
import { Loader2 } from "lucide-react";

export function FreeHostingWakeBanner() {
  const { showNotice } = useApiWakeNotice();
  if (!showNotice) return null;

  return (
    <p
      className="mb-4 flex items-start gap-3 rounded-lg border border-teal-200/80 bg-teal-50/90 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/35 dark:text-teal-50"
      role="status"
    >
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
      {FREE_HOSTING_WAKE_MESSAGE}
    </p>
  );
}
