"use client";

import { ChevronLeft, ChevronRight, MapPinned, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const CARDS = [
  {
    eyebrow: "เที่ยวหน้าฝน",
    title: "ตามหมอกขึ้นเหนือ",
    body: "วางทริปเชียงใหม่–แม่ฮ่องสอน ให้มีเวลาพักและจุดชมวิวระหว่างทาง",
    href: "/plan?new=1&gps=1&to=แม่ฮ่องสอน",
    cta: "เริ่มทริปนี้",
    image: "/recommend-mae-hong-son-collage.png",
  },
  {
    eyebrow: "ทริปทะเล",
    title: "หนีร้อนไปฝั่งอันดามัน",
    body: "รวมเกาะ จุดดำน้ำ และคาเฟ่ริมทะเลไว้เป็นเส้นทางเดียวกัน",
    href: "/plan?new=1&gps=1&to=ภูเก็ต",
    cta: "วางทริปไปภูเก็ต",
    image: "/recommend-phuket-collage.png",
  },
  {
    eyebrow: "ไทยเที่ยวไทย",
    title: "ชวนออกไปใช้วันหยุด",
    body: "เริ่มจากจังหวัดที่อยากไป แล้วให้ระบบจัดเส้นทางตามคน เวลา และงบของคุณ",
    href: "/plan?new=1&gps=1&to=น่าน",
    cta: "วางทริปไปน่าน",
    image: "/recommend-nan-collage.png",
  },
  {
    eyebrow: "เที่ยวใกล้กรุง",
    title: "เล่นน้ำตกกาญจนบุรี",
    body: "เติมความเขียวให้วันหยุด ด้วยน้ำตก เส้นทางธรรมชาติ และคาเฟ่ระหว่างทาง",
    href: "/plan?new=1&gps=1&to=กาญจนบุรี",
    cta: "วางทริปไปกาญจนบุรี",
    image: "/recommend-kanchanaburi-collage.png",
  },
];

export function HomeRecommendations() {
  const rail = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const move = (direction: -1 | 1) => rail.current?.scrollBy({ left: direction * Math.round(rail.current.clientWidth * 0.82), behavior: "smooth" });

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      const element = rail.current;
      if (!element) return;
      const step = Math.round(element.clientWidth * 0.82);
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 8;
      element.scrollTo({ left: atEnd ? 0 : element.scrollLeft + step, behavior: "smooth" });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section aria-labelledby="recommended-heading" className="select-none">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-accent">ออกไปเที่ยวกัน</p>
          <h2 id="recommended-heading" className="hl inline-block text-xl font-bold">สถานที่เที่ยวแนะนำ</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="เลื่อนรายการแนะนำไปทางซ้าย" style={{ cursor: "pointer" }} className="grid size-9 place-items-center rounded-full border-2 border-foreground bg-surface hover:bg-surface-2"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => move(1)} aria-label="เลื่อนรายการแนะนำไปทางขวา" style={{ cursor: "pointer" }} className="grid size-9 place-items-center rounded-full border-2 border-foreground bg-surface hover:bg-surface-2"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div ref={rail} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CARDS.map((card) => (
          <article key={card.title} className="relative min-h-72 w-[86%] flex-none snap-start overflow-hidden rounded-card border-2 border-foreground bg-surface shadow-hard sm:w-[58%] lg:w-[calc((100%-2rem)/3)]">
            <Image src={card.image} alt={`ภาพประกอบ ${card.title}`} fill sizes="(min-width: 1024px) 38vw, (min-width: 640px) 56vw, 84vw" className="object-cover object-right" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
            <span className="absolute right-4 top-4 z-10 inline-flex w-max max-w-[calc(100%-2rem)] items-center gap-1 rounded-full border border-white/60 bg-black/35 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm"><Sparkles className="size-3 shrink-0" /> {card.eyebrow}</span>
            <div className="relative flex min-h-72 flex-col justify-end p-5 text-white">
              <h3 className="text-2xl font-extrabold leading-tight">{card.title}</h3>
              <p className="mt-2 max-w-[34ch] text-sm text-white/85">{card.body}</p>
              <Link href={card.href} style={{ cursor: "pointer" }} className="relative z-20 mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-white bg-accent px-3 py-2 text-sm font-bold !text-white shadow-hard-sm hover:bg-brand dark:!text-black"><MapPinned className="size-4" /> {card.cta}</Link>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-2 text-xs text-subtle">เลื่อนเพื่อดูไอเดียทริปและแคมเปญท่องเที่ยวเพิ่มเติม</p>
    </section>
  );
}
