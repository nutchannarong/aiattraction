import { cache } from "react";
import type { PlaceGroupOption } from "./planner/types";
import { getSupabase } from "./supabase";

/** The 13 place groups with their attraction types and counts (for "ไปแนวไหน"). */
export const getPlaceGroups = cache(async (): Promise<PlaceGroupOption[]> => {
  const supabase = getSupabase();
  const [groups, mapping, types] = await Promise.all([
    supabase.from("place_groups").select("key, label_th, color, effort, sort").order("sort"),
    supabase.from("attraction_type_group").select("att_type, group_key"),
    supabase.from("attraction_type_options").select("att_type, att_type_label, total"),
  ]);
  if (groups.error) throw new Error(`Failed to load place groups: ${groups.error.message}`);
  if (mapping.error) throw new Error(`Failed to load type groups: ${mapping.error.message}`);
  if (types.error) throw new Error(`Failed to load types: ${types.error.message}`);

  const typeTotals = new Map<number, { label: string; total: number }>();
  for (const t of types.data ?? []) {
    const cur = typeTotals.get(t.att_type);
    typeTotals.set(t.att_type, {
      label: cur?.label ?? t.att_type_label,
      total: (cur?.total ?? 0) + t.total,
    });
  }

  return (groups.data ?? []).map((g) => {
    const groupTypes = (mapping.data ?? [])
      .filter((m) => m.group_key === g.key)
      .map((m) => ({
        id: m.att_type,
        label: typeTotals.get(m.att_type)?.label ?? "",
        total: typeTotals.get(m.att_type)?.total ?? 0,
      }))
      .filter((t) => t.total > 0)
      .sort((a, b) => b.total - a.total);
    return {
      key: g.key,
      label: g.label_th,
      color: g.color,
      effort: g.effort,
      total: groupTypes.reduce((n, t) => n + t.total, 0),
      types: groupTypes,
    };
  });
});
