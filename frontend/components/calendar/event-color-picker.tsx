"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EVENT_COLOR_PALETTE, eventContrastText, toGoogleDisplayColor } from "@/lib/event-colors";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

export function EventColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = (toGoogleDisplayColor(value) ?? value).toUpperCase();
  const display =
    EVENT_COLOR_PALETTE.find((swatch) => swatch.hex === selected)?.hex ?? selected;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="Event color"
        disabled={disabled}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-lg border-0 bg-zinc-100 px-2.5 shadow-none outline-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:bg-zinc-900",
        )}
      >
        <span
          className="size-5 shrink-0 rounded-full"
          style={{ backgroundColor: display }}
          aria-hidden
        />
        <ChevronDown className="size-4 text-zinc-600 dark:text-zinc-300" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="z-100 w-auto p-3">
        <div
          role="radiogroup"
          aria-label="Event color"
          className="grid grid-cols-6 gap-2"
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
                onClick={() => {
                  onChange(swatch.hex);
                  setOpen(false);
                }}
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
      </PopoverContent>
    </Popover>
  );
}
