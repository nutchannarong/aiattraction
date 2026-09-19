"use client";

import { cn } from "@/lib/cn";

/** On/off switch with a visible label (DESIGN.md §3 .tg). */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  hideLabel = false,
}: {
  label: string;
  hint?: string;
  /** Keep the label for screen readers only (e.g. when the row already shows it). */
  hideLabel?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm",
        hideLabel && "min-h-0",
      )}
    >
      <span className={hideLabel ? "sr-only" : undefined}>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-subtle">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 flex-none rounded-full border-2 border-foreground transition",
          checked ? "bg-secondary" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-[left]",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
