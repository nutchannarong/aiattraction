"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sticker-style dialog on the native <dialog> element: focus trapping, Esc to close
 * and the backdrop come from the browser.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[min(40rem,calc(100vw-1.5rem))] overflow-hidden rounded-card border-2 border-foreground bg-surface p-0 text-foreground shadow-hard backdrop:bg-black/45",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center gap-3 border-b-2 border-foreground bg-surface-2 px-4 py-3">
            <h2 id={titleId} className="min-w-0 flex-1 font-display text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 flex-none place-items-center rounded-full hover:bg-surface"
              aria-label="ปิด"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t-2 border-foreground bg-surface-2 px-4 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Label + control stacked, matching the planner's form fields. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-bold text-subtle">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-subtle">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none";
