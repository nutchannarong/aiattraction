"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Numbered accordion step (DESIGN.md §3 .sec); the open step gets the orange glow. */
export function StepSection({
  n,
  title,
  summary,
  open,
  disabled = false,
  disabledReason,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  summary?: ReactNode;
  open: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = `step-${n}-body`;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border-2 border-foreground bg-surface",
        open ? "shadow-active" : "shadow-hard",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={onToggle}
        className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 px-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="grid size-9 place-items-center rounded-full border-2 border-foreground bg-accent font-mono text-sm font-bold text-white dark:text-black">
          {n}
        </span>
        <span>
          <h3 className="text-base font-bold">{title}</h3>
          {summary && <span className="mt-0.5 block text-xs leading-snug text-subtle">{summary}</span>}
          {disabled && disabledReason && (
            <span className="mt-0.5 block text-xs font-semibold leading-snug text-danger">
              {disabledReason}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 text-subtle transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={bodyId} className="border-t-2 border-dashed border-border px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </section>
  );
}

/** Labelled group inside a step. */
export function StepGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 first:mt-2">
      <p className="mb-2 text-xs font-bold text-subtle">{title}</p>
      {children}
    </div>
  );
}
