import { Construction } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { StickerCard } from "@/components/ui/sticker-card";

/** Placeholder for pages that are planned but not built yet. */
export function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  return (
    <StickerCard tape className="mx-auto mt-6 max-w-xl p-6 text-center">
      <Construction className="mx-auto size-10 text-accent" aria-hidden="true" />
      <h1 className="mt-3 text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{children}</p>
      <p className="mt-1 text-xs text-subtle">หน้านี้กำลังพัฒนา</p>
      <Link href="/plan" className={buttonClass("cta", "mt-5")}>
        ไปหน้าวางแผน
      </Link>
    </StickerCard>
  );
}
