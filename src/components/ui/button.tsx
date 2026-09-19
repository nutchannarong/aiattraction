import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "cta" | "ink" | "ghost" | "mini" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  cta: "min-h-11 rounded-full border-2 border-foreground bg-accent px-5 font-bold text-white shadow-hard-sm hover:translate-x-px hover:translate-y-px hover:shadow-none dark:text-black",
  ink: "min-h-11 rounded-full border-2 border-foreground bg-foreground px-5 font-bold text-background shadow-hard-sm hover:translate-x-px hover:translate-y-px hover:shadow-none",
  ghost: "min-h-11 rounded-full border-2 border-border bg-surface px-4 font-semibold hover:border-foreground",
  mini: "min-h-10 rounded-lg border-[1.5px] border-border bg-surface px-3 text-xs font-semibold hover:border-foreground",
  danger: "min-h-10 rounded-lg border-[1.5px] border-danger-soft bg-surface px-3 text-xs font-semibold text-danger hover:border-danger",
};

/** Class string for a button look, so links can share it. */
export function buttonClass(variant: ButtonVariant = "cta", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "cta",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
