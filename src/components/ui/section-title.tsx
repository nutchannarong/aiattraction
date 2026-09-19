import type { ReactNode } from "react";

/** h2 with the marker highlight and an optional note on the same line (DESIGN.md §3 .sect). */
export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3.5 mt-8 flex flex-wrap items-baseline gap-3">
      <h2 className="hl text-xl font-bold">{children}</h2>
      {note && <p className="text-xs text-subtle">{note}</p>}
    </div>
  );
}
