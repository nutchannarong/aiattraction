import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "ink" | "accent" | "secondary";

const PRESSED: Record<Tone, string> = {
  ink: "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background",
  accent: "aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white dark:aria-pressed:text-black",
  secondary:
    "aria-pressed:border-secondary aria-pressed:bg-secondary aria-pressed:text-white dark:aria-pressed:text-black",
};

/** Toggle pill; pass `pressed` and handle onClick in the parent (DESIGN.md §3 .chip). */
export function Chip({
  pressed,
  tone = "ink",
  count,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { pressed: boolean; tone?: Tone; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-full border-2 border-border bg-surface px-3.5 text-[13px] font-semibold transition hover:border-foreground",
        PRESSED[tone],
        className,
      )}
      {...props}
    >
      {children}
      {count != null && <span className="font-mono text-[11px] opacity-70">{count.toLocaleString("th-TH")}</span>}
    </button>
  );
}
