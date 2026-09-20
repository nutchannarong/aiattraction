import type { Metadata } from "next";
import { Anuphan, IBM_Plex_Mono, Noto_Serif_Thai } from "next/font/google";
import { AppChrome } from "@/components/app-chrome";
import { SiteHeader } from "@/components/site-header";
import { THEME_INIT_SCRIPT } from "@/components/theme-toggle";
import "./globals.css";
import { ActivityTracker } from "@/components/activity-tracker";

const anuphan = Anuphan({ variable: "--font-anuphan", subsets: ["thai", "latin"] });
const notoSerifThai = Noto_Serif_Thai({
  variable: "--font-noto-serif-thai",
  subsets: ["thai", "latin"],
  weight: ["600", "700", "800"],
});
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["500", "600"] });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ไทยไหนดี — วางเส้นทางเที่ยวให้ตรงกับคนที่ไปด้วย", template: "%s · ไทยไหนดี" },
  description:
    "วางแผนขับรถเที่ยวทั่วไทยจากข้อมูล ททท. เลือกเส้นทาง จุดแวะ ที่พัก คำนวณค่าน้ำมันและค่าใช้จ่าย พร้อมแผนรายวัน",
  applicationName: "ไทยไหนดี",
  openGraph: { siteName: "ไทยไหนดี", locale: "th_TH", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${anuphan.variable} ${notoSerifThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ActivityTracker />
        <AppChrome header={<SiteHeader />}>{children}</AppChrome>
      </body>
    </html>
  );
}
