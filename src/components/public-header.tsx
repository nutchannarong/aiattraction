"use client";
import { usePathname } from "next/navigation";

/** Admin has its own navigation; preserve the public header on all other pages. */
export function PublicHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname === "/admin" || pathname.startsWith("/admin/") ? null : children;
}
