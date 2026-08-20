"use client";

import { EVENT_COLOR_PALETTE, eventContrastText, toGoogleDisplayColor } from "@/lib/event-colors";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function EventColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const selected = (toGoogleDisplayColor(value) ?? value).toUpperCase();

  return (
    <div
      role="radiogroup"
      aria-label="Event color"
      className="flex flex-wrap gap-2"
    >
      {EVENT_COLOR_PALETTE.map((swatch) => {
        const isSelected = selected === swatch.hex;
        return (
          <button
            key={swatch.hex}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={swatch.label}
            title={swatch.label}
            disabled={disabled}
            onClick={() => onChange(swatch.hex)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border-2 transition-shadow",
              isSelected
                ? "border-zinc-900 shadow-sm dark:border-zinc-50"
                : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600",
              disabled && "cursor-not-allowed opacity-60",
            )}
            style={{ backgroundColor: swatch.hex }}
          >
            {isSelected ? (
              <Check
                className={cn(
                  "size-3.5 drop-shadow-sm",
                  eventContrastText(swatch.hex) === "#FFFFFF"
                    ? "text-white"
                    : "text-zinc-900",
                )}
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
