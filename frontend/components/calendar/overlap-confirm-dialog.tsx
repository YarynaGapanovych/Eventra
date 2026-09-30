"use client";

import { Button } from "@/components/ui/button";
import { formatOverlapNames } from "@/lib/event-overlap";
import { X } from "lucide-react";
import { useEffect } from "react";

export function OverlapConfirmDialog({
  open,
  titles,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  titles: string[];
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const names = formatOverlapNames(titles);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlap-confirm-title"
    >
      <Button
        type="button"
        variant="ghost"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 z-0 h-full min-h-0 w-full cursor-default rounded-none border-0 bg-zinc-950/40 p-0 shadow-none ring-0 backdrop-blur-sm hover:bg-zinc-950/45 focus-visible:ring-0 dark:bg-black/50 dark:hover:bg-black/55"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="overlap-confirm-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            This time overlaps another event
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onCancel}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          This time overlaps {names}. Is that okay?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
