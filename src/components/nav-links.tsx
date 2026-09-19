"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "วางแผน", match: (p: string) => p === "/" || p.startsWith("/plan") },
  { href: "/attractions", label: "ค้นหาสถานที่", match: (p: string) => p.startsWith("/attractions") },
  { href: "/nearby", label: "ใกล้ฉัน", match: (p: string) => p.startsWith("/nearby") },
  { href: "/trips", label: "แผนของฉัน", match: (p: string) => p === "/trips" },
  { href: "/live", label: "กำลังเดินทาง", match: (p: string) => p.startsWith("/live") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="order-3 flex w-full gap-1 overflow-x-auto [scrollbar-width:none] sm:order-none sm:ml-auto sm:w-auto"
    >
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center whitespace-nowrap rounded-full border-2 px-3.5 text-[13px] font-semibold",
              active ? "border-foreground bg-foreground text-background" : "border-transparent hover:border-border",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
