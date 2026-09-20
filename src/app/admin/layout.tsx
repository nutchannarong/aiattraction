import type { Metadata } from "next";
export const metadata: Metadata = { title: "รายงานหลังบ้าน", robots: { index: false, follow: false } };
/** The site header is hidden on /admin (AppChrome), so the console brings its own page frame. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10">{children}</main>;
}
