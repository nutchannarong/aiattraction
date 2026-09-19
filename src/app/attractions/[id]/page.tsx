import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttractionMap, hasValidCoordinates } from "@/components/attraction-map";
import { DistanceFromMe } from "@/components/distance-from-me";
import { RoadsideCard, RoadsideCardSkeleton } from "@/components/roadside-card";
import { WeatherCard, WeatherCardSkeleton } from "@/components/weather-card";
import { CATEGORIES, getAttraction, htmlToText, toExternalUrl } from "@/lib/attractions";

export async function generateMetadata({
  params,
}: PageProps<"/attractions/[id]">): Promise<Metadata> {
  const attraction = await getAttraction((await params).id);
  if (!attraction) return {};
  return {
    title: attraction.att_name_th,
    description: htmlToText(attraction.att_detail_th).slice(0, 160),
  };
}

function Section({ title, text }: { title: string; text: string | null }) {
  const body = htmlToText(text);
  if (!body) return null;
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>
    </section>
  );
}

function fee(adult: number | null, kid: number | null) {
  if (adult == null && kid == null) return null;
  const parts = [];
  if (adult != null) parts.push(adult === 0 ? "ฟรี" : `${adult} บาท`);
  if (kid != null) parts.push(`เด็ก ${kid === 0 ? "ฟรี" : `${kid} บาท`}`);
  return parts.join(" / ");
}

export default async function AttractionPage({ params }: PageProps<"/attractions/[id]">) {
  const a = await getAttraction((await params).id);
  if (!a) notFound();

  const address = [
    a.att_address,
    a.att_address_alley && `ซ.${a.att_address_alley}`,
    a.att_address_road && `ถ.${a.att_address_road}`,
    a.subdistrict_name_th && `ต.${a.subdistrict_name_th}`,
    a.district_name_th && `อ.${a.district_name_th}`,
    a.province_name_th && `จ.${a.province_name_th}`,
    a.att_postcode,
  ]
    .filter(Boolean)
    .join(" ");

  const info: [string, string | null][] = [
    ["ที่อยู่", address || null],
    ["เวลาเปิด-ปิด", a.att_start_end],
    ["ค่าเข้าชม (คนไทย)", fee(a.att_fee_th, a.att_fee_th_kid)],
    ["ค่าเข้าชม (ต่างชาติ)", fee(a.att_fee_en, a.att_fee_en_kid)],
    ["ระยะเวลาที่เหมาะสม", a.att_suitable_duration],
    ["โทรศัพท์", a.att_tel],
    ["อีเมล", a.att_email],
    ["การชำระเงิน", a.att_payment],
  ];

  const links = [
    ["เว็บไซต์", toExternalUrl(a.att_website)],
    ["Facebook", toExternalUrl(a.att_facebook)],
    ["Instagram", toExternalUrl(a.att_instagram)],
    ["TikTok", toExternalUrl(a.att_tiktok)],
    ["YouTube", toExternalUrl(a.att_youtube)],
  ].filter((l): l is [string, string] => Boolean(l[1]));

  const hasMap = hasValidCoordinates(a.latitude, a.longitude);
  const mapUrl = hasMap
    ? `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`
    : null;

  return (
    <article className="space-y-6">
      <Link href="/" className="text-sm text-accent">
        ← กลับไปหน้าค้นหา
      </Link>

      <header className="space-y-2">
        <p className="text-sm text-secondary">
          {[a.att_category && CATEGORIES[a.att_category], a.att_type_label]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="text-2xl font-bold">{a.att_name_th}</h1>
        {a.att_name_en && <p className="text-muted">{a.att_name_en}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {hasMap && (
            <Suspense fallback={<WeatherCardSkeleton />}>
              <WeatherCard latitude={a.latitude!} longitude={a.longitude!} />
            </Suspense>
          )}
          {hasMap && (
            <Suspense fallback={<RoadsideCardSkeleton />}>
              <RoadsideCard latitude={a.latitude!} longitude={a.longitude!} />
            </Suspense>
          )}
          <div className="space-y-6 rounded-xl border border-border bg-surface p-5">
            <Section title="รายละเอียด" text={a.att_detail_th} />
            <Section title="Description" text={a.att_detail_en} />
            <Section title="ไฮไลต์" text={a.att_hilight} />
            <Section title="กิจกรรม" text={a.att_activity} />
            <Section title="การเดินทาง" text={a.att_accessibility} />
            <Section title="สถานที่ใกล้เคียง" text={a.att_nearby_location} />
            <Section title="สิ่งอำนวยความสะดวก" text={a.att_facilities_contact} />
            <Section title="ข้อควรปฏิบัติ" text={a.att_rule} />
            <Section title="การเตรียมตัว" text={a.att_traveler_pre} />
            <Section title="การจอง" text={a.att_booking_detail} />
            <Section title="หมายเหตุ" text={a.att_remark} />
          </div>
        </div>

        <aside className="space-y-4 self-start rounded-xl border border-border bg-surface p-5 text-sm">
          {hasMap && (
            <AttractionMap latitude={a.latitude!} longitude={a.longitude!} name={a.att_name_th} />
          )}
          <dl className="space-y-3">
            {hasMap && <DistanceFromMe target={{ latitude: a.latitude!, longitude: a.longitude! }} />}
            {info
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-accent px-4 py-2 text-center font-medium text-white dark:text-black"
            >
              เปิดใน Google Maps
            </a>
          )}
          {links.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </article>
  );
}
