import { cache } from "react";
import { NEARBY_RADIUS_M } from "./geo";
import { getSupabase } from "./supabase";

export const PAGE_SIZE = 24;

// Canonical labels by id: some imported rows carry mis-encoded label text.
export const CATEGORIES: Record<number, string> = {
  1: "แหล่งท่องเที่ยวทางธรรมชาติ",
  2: "แหล่งท่องเที่ยวทางประวัติศาสตร์ และวัฒนธรรม",
  3: "แหล่งท่องเที่ยวสำหรับกิจกรรมพิเศษ นันทนาการ และความสนใจพิเศษ",
};

const LIST_COLUMNS =
  "att_id, att_name_th, att_name_en, att_category, att_type_label, province_name_th, district_name_th, att_start_end, att_fee_th";

export type AttractionSummary = {
  att_id: string;
  att_name_th: string;
  att_name_en: string | null;
  att_category: number | null;
  att_type_label: string | null;
  province_name_th: string | null;
  district_name_th: string | null;
  att_start_end: string | null;
  att_fee_th: number | null;
};

export type Attraction = AttractionSummary & {
  att_detail_th: string | null;
  att_detail_en: string | null;
  att_nearby_location: string | null;
  att_address: string | null;
  att_address_alley: string | null;
  att_address_road: string | null;
  subdistrict_name_th: string | null;
  region_name_th: string | null;
  att_postcode: string | null;
  att_tel: string | null;
  att_email: string | null;
  att_fee_th_kid: number | null;
  att_fee_en: number | null;
  att_fee_en_kid: number | null;
  att_activity: string | null;
  att_hilight: string | null;
  att_suitable_duration: string | null;
  att_rule: string | null;
  att_accessibility: string | null;
  att_traveler_pre: string | null;
  att_facilities_contact: string | null;
  latitude: number | null;
  longitude: number | null;
  att_website: string | null;
  att_facebook: string | null;
  att_instagram: string | null;
  att_tiktok: string | null;
  att_youtube: string | null;
  att_line: string | null;
  att_payment: string | null;
  att_remark: string | null;
  att_booking_detail: string | null;
};

export type TypeOption = {
  att_category: number;
  att_type: number;
  att_type_label: string;
  total: number;
};

export type ProvinceOption = {
  att_province_id: string;
  province_name_th: string;
  region_name_th: string | null;
  total: number;
};

export type AttractionFilters = {
  q?: string;
  category?: number;
  type?: number;
  province?: string;
  page?: number;
};

export async function searchAttractions(filters: AttractionFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = getSupabase()
    .from("attraction")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("att_name_th")
    .range(from, from + PAGE_SIZE - 1);

  // Characters that are part of PostgREST's filter syntax are dropped.
  const q = filters.q?.replace(/[,()"\\%*]/g, " ").trim();
  if (q) {
    query = query.or(
      `att_name_th.ilike.%${q}%,att_name_en.ilike.%${q}%,province_name_th.ilike.%${q}%,district_name_th.ilike.%${q}%`,
    );
  }
  if (filters.category) query = query.eq("att_category", filters.category);
  if (filters.type) query = query.eq("att_type", filters.type);
  if (filters.province) query = query.eq("att_province_id", filters.province);

  const { data, count, error } = await query.returns<AttractionSummary[]>();
  if (error) throw new Error(`Failed to load attractions: ${error.message}`);

  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}

// cache() dedupes the call shared by generateMetadata and the page.
export const getAttraction = cache(async (id: string) => {
  const { data, error } = await getSupabase()
    .from("attraction")
    .select("*")
    .eq("att_id", id)
    .maybeSingle<Attraction>();
  if (error) throw new Error(`Failed to load attraction: ${error.message}`);
  return data;
});

export async function getFilterOptions() {
  const [types, provinces] = await Promise.all([
    getSupabase()
      .from("attraction_type_options")
      .select("*")
      .order("att_type_label")
      .returns<TypeOption[]>(),
    getSupabase()
      .from("attraction_province_options")
      .select("*")
      .order("province_name_th")
      .returns<ProvinceOption[]>(),
  ]);
  if (types.error) throw new Error(types.error.message);
  if (provinces.error) throw new Error(provinces.error.message);
  return { types: types.data ?? [], provinces: provinces.data ?? [] };
}

/** Turns the rich-text HTML stored in detail fields into plain text. */
export function htmlToText(html: string | null) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toExternalUrl(value: string | null) {
  if (!value) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return null;
}

export type NearbyAttraction = Pick<
  AttractionSummary,
  | "att_id"
  | "att_name_th"
  | "att_name_en"
  | "att_type_label"
  | "province_name_th"
  | "district_name_th"
> & { distance_m: number };

const NEARBY_LIMIT = 30;

/** Nearest attractions to a point, closest first. */
export async function getNearbyAttractions(
  latitude: number,
  longitude: number,
): Promise<NearbyAttraction[]> {
  const { data, error } = await getSupabase().rpc("nearby_attractions", {
    lat: latitude,
    lng: longitude,
    max_results: NEARBY_LIMIT,
    radius_m: NEARBY_RADIUS_M,
  });
  if (error) throw new Error(`Failed to load nearby attractions: ${error.message}`);
  // .returns<T>() doesn't type-check on rpc() with an untyped client.
  return (data ?? []) as NearbyAttraction[];
}
