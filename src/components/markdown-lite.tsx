import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// ---- Minimal Markdown (headings, lists, bold/italic, rules) without injecting HTML.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-surface-2 px-1 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: { indent: number; text: string }[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={blocks.length}
        className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}
      >
        {list.items.map((it, i) => (
          <li key={i} className={it.indent >= 2 ? "ml-4 list-[circle]" : undefined}>
            {inline(it.text)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const m = (bullet ?? numbered)!;
      const ordered = Boolean(numbered) && m[1].length < 2;
      // Indented bullets under a numbered item stay in that list.
      if (!list || (list.ordered !== ordered && m[1].length < 2)) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push({ indent: m[1].length, text: m[2] });
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (/^-{3,}$|^\*{3,}$/.test(line.trim())) {
      blocks.push(<hr key={blocks.length} className="border-dashed border-border" />);
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={blocks.length} className="font-display font-bold">
          {inline(heading[1])}
        </p>,
      );
      continue;
    }
    blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 break-words">{blocks}</div>;
}
