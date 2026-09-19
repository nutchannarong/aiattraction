import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Noto_Sans_Thai } from "next/font/google";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ไทยไหนดี — ค้นหาที่เที่ยวทั่วไทย", template: "%s · ไทยไหนดี" },
  description:
    "ค้นหาแหล่งท่องเที่ยวทั่วประเทศไทย พร้อมแผนที่ สภาพอากาศ ปั๊มน้ำมันและจุดแวะพักรถใกล้เคียง",
  applicationName: "ไทยไหนดี",
  openGraph: { siteName: "ไทยไหนดี", locale: "th_TH", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold">
              <Image src="/brand-mark.png" alt="" width={40} height={40} priority />
              <span>
                ไทย<span className="text-accent">ไหนดี</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/nearby" className="text-sm hover:text-accent">
                ใกล้ฉัน
              </Link>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
