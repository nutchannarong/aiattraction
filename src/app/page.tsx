import { Car, MapPinned, Route, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HomeRecommendations } from "@/components/home-recommendations";
import { buttonClass } from "@/components/ui/button";
import { StickerCard } from "@/components/ui/sticker-card";
import { countAttractions } from "@/lib/attractions";

const STEPS = [
  { icon: MapPinned, title: "จะไปไหน เมื่อไร", body: "เลือกจังหวัด ปักหมุด หรือค้นหาสถานที่ พร้อมป้ายเมืองหลัก/เมืองรอง" },
  { icon: Route, title: "เลือกรูปแบบเส้นทาง", body: "เร็วที่สุด ชมวิวธรรมชาติ ผ่านชุมชน ผสม หรือลากเส้นทางเอง" },
  { icon: Car, title: "ขับรถอะไร", body: "คำนวณค่าน้ำมันจากราคา ปตท. วันนี้ ตามชนิดรถและเชื้อเพลิง" },
  { icon: Wallet, title: "แผนรายวันและค่าใช้จ่าย", body: "จัดกิจกรรมทีละวัน เลือกที่พัก จองผ่านช่องทางที่ถูกที่สุด แล้วสรุปงบ" },
];

export default async function Home() {
  const total = await countAttractions();

  return (
    <div className="space-y-10">
      <section className="grid overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard md:grid-cols-[1.25fr_0.85fr]">
        <div className="relative z-10 self-center px-6 py-7">
          <span className="inline-block rounded-full border-[1.5px] border-foreground bg-accent px-3 py-0.5 text-xs font-bold text-white dark:text-black">
            ข้อมูลเปิด ททท. · <span className="font-mono">{total.toLocaleString("th-TH")}</span> แหล่งท่องเที่ยว
          </span>
          <h1 className="mt-3 mb-2.5 max-w-[18ch] text-[clamp(26px,4.2vw,42px)] font-extrabold leading-tight tracking-tight">
            ไทยไหนดี — วางเส้นทางให้ตรงกับ <em className="hl not-italic text-accent">คนที่ไปด้วยจริง ๆ</em>
          </h1>
          <p className="max-w-[58ch] text-muted">
            บอกว่าไปไหน ไปกับใคร ขับรถอะไร แล้วระบบจะร่างเส้นทาง จุดแวะ และแผนรายวันให้
            พร้อมเวลาเดินทาง ค่าน้ำมัน ค่าเข้าชม และเตือนถ้าที่ไหนปิดในวันที่คุณจะไป
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/plan" className={buttonClass("cta")}>
              เริ่มวางแผนเที่ยว
            </Link>
            <Link href="/attractions" className={buttonClass("ghost")}>
              ค้นหาสถานที่
            </Link>
          </div>
        </div>
        <div className="relative order-first min-h-44 border-b-2 border-foreground md:order-none md:min-h-60 md:border-b-0 md:border-l-2">
          <Image
            src="/hero-collage.jpg"
            alt="ภาพคอลลาจนักเดินทางบนรถมินิสีส้ม วัด เกาะ และเสาชิงช้า"
            fill
            priority
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover object-[52%_46%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent md:bg-gradient-to-r" />
        </div>
      </section>

      <section>
        <h2 className="hl mb-4 inline-block text-xl font-bold">วางแผนใน 4 ขั้นตอน</h2>
        <ol className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <StickerCard className="h-full p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full border-2 border-foreground bg-accent font-mono text-sm font-bold text-white dark:text-black">
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-secondary" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </StickerCard>
            </li>
          ))}
        </ol>
      </section>

      <HomeRecommendations />

      <section className="grid gap-3.5 md:grid-cols-3">
        <div>
          <h2 className="font-bold">ข้อมูลนี้มาจากไหน</h2>
          <p className="mt-1 text-sm text-muted">
            แหล่งท่องเที่ยวจากทะเบียนของการท่องเที่ยวแห่งประเทศไทย (ททท.) ร้านอาหาร ที่พัก ปั๊มน้ำมัน
            และจุดบริการจาก OpenStreetMap
          </p>
        </div>
        <div>
          <h2 className="font-bold">ระบบคำนวณเอง</h2>
          <p className="mt-1 text-sm text-muted">
            เส้นทางและเวลาเดินทาง (OSRM ไม่รวมสภาพจราจร) ค่าน้ำมันจากอัตราสิ้นเปลืองโดยประมาณ
            และราคาน้ำมัน ปตท. กรุงเทพฯ
          </p>
        </div>
        <div>
          <h2 className="font-bold">สิ่งที่ยังบอกไม่ได้</h2>
          <p className="mt-1 text-sm text-muted">
            ราคาที่พักจริงของแต่ละเว็บ รีวิวร้าน และสภาพจราจรสด — เราจะพาไปดูที่ต้นทางแทนการเดา
          </p>
        </div>
      </section>
    </div>
  );
}
