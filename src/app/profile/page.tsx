import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchableSelect, type SearchableOption } from "@/components/searchable-select";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StickerCard } from "@/components/ui/sticker-card";
import { ageFromBirthDate, GENDER_LABEL, getMyProfile, type Gender } from "@/lib/profile";
import { cityTierLabel, getProvinces } from "@/lib/provinces";
import { getCurrentUser } from "@/lib/supabase-server";
import { saveProfile } from "./actions";

export const metadata: Metadata = { title: "โปรไฟล์ของฉัน" };

const OCCUPATIONS = [
  "นักเรียน / นักศึกษา",
  "พนักงานบริษัท",
  "ข้าราชการ / รัฐวิสาหกิจ",
  "ธุรกิจส่วนตัว",
  "ฟรีแลนซ์",
  "ค้าขาย",
  "เกษตรกร",
  "แม่บ้าน / พ่อบ้าน",
  "เกษียณ",
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const params = await searchParams;
  const next = first(params.next) ?? "";
  const user = await getCurrentUser();
  if (!user) {
    const back = next ? `/profile?next=${encodeURIComponent(next)}` : "/profile";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const [profile, provinces] = await Promise.all([getMyProfile(), getProvinces()]);
  const provinceOptions: SearchableOption[] = provinces
    .toSorted(
      (a, b) =>
        (a.region_th ?? "").localeCompare(b.region_th ?? "", "th") ||
        a.name_th.localeCompare(b.name_th, "th"),
    )
    .map((p) => ({
      value: p.id,
      label: `${p.name_th} · ${cityTierLabel(p.is_secondary_city)}`,
      group: p.region_th ?? "อื่น ๆ",
    }));

  const error = first(params.error);
  const age = profile?.birth_date ? ageFromBirthDate(profile.birth_date) : null;
  const field =
    "min-h-11 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3 focus:border-accent focus:outline-none";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">
          <span className="hl">โปรไฟล์</span>ของฉัน
        </h1>
        <p className="mt-1 text-sm text-muted">
          ใช้ช่วยแนะนำที่เที่ยวให้เหมาะกับช่วงวัย และเสนอเส้นทาง &ldquo;กลับบ้าน&rdquo; ไปจังหวัดบ้านเกิด
        </p>
      </div>

      {first(params.welcome) && (
        <Callout tone="info" title="ยินดีต้อนรับสู่ไทยไหนดี">
          กรอกข้อมูลอีกนิดเพื่อให้ระบบแนะนำทริปได้ตรงกับคุณ
        </Callout>
      )}
      {first(params.saved) && <Callout tone="success">บันทึกโปรไฟล์แล้ว</Callout>}
      {error && <Callout tone="danger">{error}</Callout>}

      <StickerCard className="p-5">
        <form action={saveProfile} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1.5">
            <label htmlFor="full_name" className="text-sm font-medium">
              ชื่อ-นามสกุล
            </label>
            <input
              id="full_name"
              name="full_name"
              required
              autoComplete="name"
              defaultValue={profile?.full_name ?? ""}
              className={field}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="birth_date" className="text-sm font-medium">
              วันเดือนปีเกิด
            </label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              required
              min="1900-01-01"
              max={today}
              autoComplete="bday"
              defaultValue={profile?.birth_date ?? ""}
              className={field}
            />
            {age != null && <p className="text-xs text-subtle">อายุ {age} ปี</p>}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">เพศ</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                <label key={g} className="cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    required
                    defaultChecked={profile?.gender === g}
                    className="peer sr-only"
                  />
                  <span className="inline-flex min-h-10 items-center rounded-full border-2 border-border bg-surface px-4 text-sm font-semibold peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
                    {GENDER_LABEL[g]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">จังหวัดบ้านเกิด</p>
            <SearchableSelect
              name="home_province_id"
              placeholder="พิมพ์ชื่อจังหวัด"
              options={provinceOptions}
              value={profile?.home_province_id ?? ""}
            />
            <p className="text-xs text-subtle">
              บอกด้วยว่าเป็นเมืองหลักหรือเมืองรอง (55 จังหวัดเมืองรองตามประกาศกระทรวงการท่องเที่ยวและกีฬา)
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="occupation" className="text-sm font-medium">
              อาชีพ <span className="font-normal text-subtle">(ไม่บังคับ)</span>
            </label>
            <input
              id="occupation"
              name="occupation"
              list="occupations"
              defaultValue={profile?.occupation ?? ""}
              className={field}
            />
            <datalist id="occupations">
              {OCCUPATIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>

          <button className={buttonClass("cta", "w-full")}>บันทึกโปรไฟล์</button>
        </form>
      </StickerCard>
      <p className="text-center text-xs text-subtle">อีเมลที่ใช้เข้าสู่ระบบ: {user.email}</p>
    </div>
  );
}
