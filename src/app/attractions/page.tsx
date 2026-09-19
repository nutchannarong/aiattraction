import type { Metadata } from "next";
import Link from "next/link";
import { SearchableSelect, type SearchableOption } from "@/components/searchable-select";
import { buttonClass } from "@/components/ui/button";
import { StickerCard } from "@/components/ui/sticker-card";
import {
  CATEGORIES,
  getFilterOptions,
  searchAttractions,
  type AttractionFilters,
  type ProvinceOption,
} from "@/lib/attractions";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toInt(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export const metadata: Metadata = { title: "ค้นหาสถานที่ท่องเที่ยว" };

export default async function AttractionsPage({ searchParams }: PageProps<"/attractions">) {
  const params = await searchParams;
  const filters: AttractionFilters = {
    q: first(params.q),
    category: toInt(first(params.category)),
    type: toInt(first(params.type)),
    province: first(params.province) || undefined,
    page: toInt(first(params.page)),
  };

  const [result, options] = await Promise.all([searchAttractions(filters), getFilterOptions()]);

  const types = options.types.filter(
    (t) => !filters.category || t.att_category === filters.category,
  );
  const provincesByRegion = options.provinces.reduce<Record<string, ProvinceOption[]>>((acc, p) => {
    if (!p.province_name_th) return acc;
    (acc[p.region_name_th ?? "อื่น ๆ"] ??= []).push(p);
    return acc;
  }, {});

  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set("q", filters.q);
    if (filters.category) sp.set("category", String(filters.category));
    if (filters.type) sp.set("type", String(filters.type));
    if (filters.province) sp.set("province", filters.province);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return s ? `/attractions?${s}` : "/attractions";
  };

  const field =
    "min-h-11 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none";

  const categoryOptions: SearchableOption[] = Object.entries(CATEGORIES).map(([id, label]) => ({
    value: id,
    label,
  }));
  const typeOptions: SearchableOption[] = Array.from(
    types.reduce((byType, type) => {
      const current = byType.get(type.att_type);
      byType.set(type.att_type, {
        value: String(type.att_type),
        label: type.att_type_label,
        total: (current?.total ?? 0) + type.total,
      });
      return byType;
    }, new Map<number, SearchableOption & { total: number }>()),
  ).map(([, type]) => ({
    value: type.value,
    label: `${type.label} (${type.total})`,
  }));
  const provinceOptions: SearchableOption[] = Object.entries(provincesByRegion).flatMap(
    ([region, provinces]) =>
      provinces.map((p) => ({
        value: p.att_province_id,
        label: `${p.province_name_th} (${p.total})`,
        group: region,
      })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">ค้นหาสถานที่ท่องเที่ยว</h1>
        <p className="text-sm text-muted">ข้อมูลแหล่งท่องเที่ยวจาก ททท. ทั่วประเทศ</p>
      </div>
      <StickerCard className="p-4">
        <form className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="ค้นหาชื่อสถานที่ จังหวัด อำเภอ"
            className={field}
          />
          <SearchableSelect
            name="category"
            placeholder="ทุกหมวดหมู่"
            options={categoryOptions}
            value={filters.category ? String(filters.category) : ""}
          />
          <SearchableSelect
            name="type"
            placeholder="ทุกประเภท"
            options={typeOptions}
            value={filters.type ? String(filters.type) : ""}
          />
          <SearchableSelect
            name="province"
            placeholder="ทุกจังหวัด"
            options={provinceOptions}
            value={filters.province ?? ""}
          />
          <button className={buttonClass("cta")}>ค้นหา</button>
        </form>
      </StickerCard>

      <p className="text-sm text-muted">
        พบ <span className="font-mono tabular-nums">{result.total.toLocaleString("th-TH")}</span>{" "}
        แห่ง
      </p>

      {result.items.length === 0 ? (
        <p className="py-16 text-center text-muted">ไม่พบสถานที่ที่ตรงกับเงื่อนไข</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((a) => (
            <li key={a.att_id}>
              <Link
                href={`/attractions/${a.att_id}`}
                className="flex h-full flex-col gap-2 rounded-[13px] border-2 border-foreground bg-surface p-4 shadow-hard transition hover:-translate-y-0.5"
              >
                <span className="text-xs text-secondary">{a.att_type_label}</span>
                <span className="font-display font-bold leading-snug">{a.att_name_th}</span>
                {a.att_name_en && <span className="text-sm text-muted">{a.att_name_en}</span>}
                <span className="mt-auto border-t-[1.5px] border-dashed border-border pt-2 text-xs text-subtle">
                  {[a.district_name_th, a.province_name_th].filter(Boolean).join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className="text-accent">
              ← ก่อนหน้า
            </Link>
          ) : (
            <span className="text-muted">← ก่อนหน้า</span>
          )}
          <span>
            หน้า {result.page} / {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className="text-accent">
              ถัดไป →
            </Link>
          ) : (
            <span className="text-muted">ถัดไป →</span>
          )}
        </nav>
      )}
    </div>
  );
}
