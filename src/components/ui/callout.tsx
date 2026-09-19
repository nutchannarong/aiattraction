import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "note" | "danger" | "info" | "success";

const TONES: Record<Tone, string> = {
  note: "bg-surface-2 border-l-brand",
  danger: "bg-danger-soft border-l-danger",
  info: "bg-info-soft border-l-info",
  success: "bg-secondary-soft border-l-secondary",
};

/** Left-bar notice for limits and warnings (DESIGN.md §3 .warn). */
export function Callout({
  tone = "note",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn("rounded-xl border-2 border-l-[7px] border-foreground px-3.5 py-2.5 text-sm", TONES[tone], className)}
    >
      {title && <p className="mb-0.5 font-bold">{title}</p>}
      {children}
    </div>
  );
}
