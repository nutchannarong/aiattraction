import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Base "sticker" surface: ink border + hard shadow (DESIGN.md §3 .sticker). */
export function StickerCard({
  className,
  tape = false,
  children,
  ...props
}: ComponentProps<"div"> & { tape?: boolean }) {
  return (
    <div
      className={cn("relative rounded-card border-2 border-foreground bg-surface shadow-hard", className)}
      {...props}
    >
      {tape && (
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-6 h-[18px] w-[66px] -rotate-3 border-[1.5px] border-foreground bg-brand opacity-90"
        />
      )}
      {children}
    </div>
  );
}
