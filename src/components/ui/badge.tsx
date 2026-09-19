import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "secondary" | "info" | "accent" | "danger" | "brand" | "neutral";

const TONES: Record<BadgeTone, string> = {
  secondary: "bg-secondary-soft text-secondary",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  brand: "border-foreground bg-accent text-white dark:text-black",
  neutral: "bg-surface-2 text-muted",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] border-transparent px-2 py-0.5 text-xs font-bold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** เมืองหลัก / เมืองรอง marker for provinces. */
export function CityTierBadge({ isSecondary }: { isSecondary: boolean }) {
  return <Badge tone={isSecondary ? "brand" : "info"}>{isSecondary ? "เมืองรอง" : "เมืองหลัก"}</Badge>;
}
