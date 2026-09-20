"use client";

import { usePathname } from "next/navigation";

export function AppChrome({ children, header }: { children: React.ReactNode; header: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;
  return (
    <>
      {header}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 pb-20 pt-5 sm:px-5">{children}</main>
    </>
  );
}
