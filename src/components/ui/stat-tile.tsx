import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatTile({ value, label, emphasis = false }: { value: ReactNode; label: string; emphasis?: boolean }) {
  return (
    <div className="rounded-[13px] border-2 border-foreground bg-surface px-3.5 py-3 shadow-hard">
      <p className={cn("font-mono text-2xl font-semibold leading-tight tabular-nums", emphasis && "text-accent")}>{value}</p>
      <p className="mt-0.5 text-xs text-subtle">{label}</p>
    </div>
  );
}
