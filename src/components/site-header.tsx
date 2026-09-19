import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2 sm:px-5 sm:py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand-mark.png" alt="" width={38} height={38} priority />
          <span>
            <b className="block font-display text-lg font-extrabold leading-tight tracking-tight sm:text-xl">
              ไทย<span className="text-accent">ไหนดี</span>
            </b>
            <span className="hidden text-[11px] text-subtle md:block">วางเส้นทาง แวะเมืองรอง จากข้อมูล ททท.</span>
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
