"use client";

import { Minus, Plus } from "lucide-react";

/** Count row with −/+ buttons (DESIGN.md §3 .stepper). */
export function Stepper({
  label,
  hint,
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const btn =
    "grid size-11 place-items-center rounded-full border-2 border-foreground bg-surface disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-dashed border-border-soft py-2 last:border-b-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className={btn}
          aria-label={`ลด${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <b className="min-w-6 text-center font-mono text-base tabular-nums" aria-live="polite">
          {value}
        </b>
        <button
          type="button"
          className={btn}
          aria-label={`เพิ่ม${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
