"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase-server";

const uuid = z.string().uuid();
const statusSchema = z.enum(["completed", "skipped", "pending"]);
const replacementSchema = z.object({
  source: z.enum(["attraction", "poi", "place", "pin"]),
  id: z.string().max(80).nullable(),
  name: z.string().min(1).max(300),
  area: z.string().max(500).nullable(),
  latitude: z.number().min(4).max(22),
  longitude: z.number().min(96).max(107),
  category: z.string().max(80).nullable(),
  isSecondaryCity: z.boolean().nullable(),
  phone: z.string().max(200).nullable(),
  openingHours: z.string().max(500).nullable(),
  warning: z.string().max(500).nullable(),
});

async function ownedTrip(tripId: string) {
  const parsed = uuid.safeParse(tripId);
  if (!parsed.success) return null;
  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;
  const { data: trip } = await supabase
    .from("trips")
    .select("id,started_at")
    .eq("id", parsed.data)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  return trip
    ? {
        supabase,
        userId: auth.claims.sub,
        tripId: parsed.data,
        startedAt: trip.started_at as string | null,
      }
    : null;
}

async function tripDayIds(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  tripId: string,
) {
  const { data } = await supabase.from("trip_days").select("id").eq("trip_id", tripId);
  return (data ?? []).map((day) => day.id as string);
}

export async function deleteTrip(tripId: string) {
  const owned = await ownedTrip(tripId);
  if (!owned) return { error: "ไม่พบแผนหรือไม่มีสิทธิ์ลบ" };
  const { error } = await owned.supabase.from("trips").delete().eq("id", owned.tripId);
  if (error) return { error: "ลบแผนไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath("/trips");
  return { ok: true as const };
}

export async function setTripItemProgress(
  tripId: string,
  itemId: string,
  status: "completed" | "skipped" | "pending",
) {
  const parsedItem = uuid.safeParse(itemId);
  const parsedStatus = statusSchema.safeParse(status);
  const owned = await ownedTrip(tripId);
  if (!owned || !parsedItem.success || !parsedStatus.success)
    return { error: "ข้อมูลความคืบหน้าไม่ถูกต้อง" };

  const dayIds = await tripDayIds(owned.supabase, owned.tripId);
  if (!dayIds.length) return { error: "ไม่พบรายการในแผนนี้" };
  const completedAt = parsedStatus.data === "completed" ? new Date().toISOString() : null;
  const { data, error } = await owned.supabase
    .from("trip_items")
    .update({ progress_status: parsedStatus.data, completed_at: completedAt })
    .eq("id", parsedItem.data)
    .in("day_id", dayIds)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "บันทึกความคืบหน้าไม่สำเร็จ" };

  const { data: items } = await owned.supabase
    .from("trip_items")
    .select("day_id,kind,latitude,progress_status")
    .in("day_id", dayIds);
  const navigable = (items ?? []).filter((item) => item.kind !== "drive" && item.latitude != null);
  const now = new Date().toISOString();
  for (const dayId of dayIds) {
    const dayItems = navigable.filter((item) => item.day_id === dayId);
    const finished = dayItems.length > 0 && dayItems.every((item) => item.progress_status !== "pending");
    await owned.supabase
      .from("trip_days")
      .update({ finished_at: finished ? now : null })
      .eq("id", dayId);
  }
  const allDone = navigable.length > 0 && navigable.every((item) => item.progress_status !== "pending");
  await owned.supabase
    .from("trips")
    .update({
      status: allDone ? "done" : "active",
      started_at: owned.startedAt ?? now,
      completed_at: allDone ? now : null,
    })
    .eq("id", owned.tripId);
  revalidatePath("/trips");
  revalidatePath("/live");
  return { ok: true as const };
}

export async function replaceTripItemPlace(
  tripId: string,
  itemId: string,
  replacement: z.input<typeof replacementSchema>,
) {
  const parsedItem = uuid.safeParse(itemId);
  const parsed = replacementSchema.safeParse(replacement);
  const owned = await ownedTrip(tripId);
  if (!owned || !parsedItem.success || !parsed.success)
    return { error: "ข้อมูลสถานที่ใหม่ไม่ถูกต้อง" };
  const dayIds = await tripDayIds(owned.supabase, owned.tripId);
  const p = parsed.data;
  const { data, error } = await owned.supabase
    .from("trip_items")
    .update({
      place_source: p.source,
      place_id: p.id,
      place_name: p.name,
      place_category: p.category,
      is_secondary_city: p.isSecondaryCity,
      latitude: p.latitude,
      longitude: p.longitude,
      address: p.area,
      phone: p.phone,
      opening_hours: p.openingHours,
      warning: p.warning,
    })
    .eq("id", parsedItem.data)
    .in("day_id", dayIds)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "เปลี่ยนสถานที่ไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath("/live");
  return { ok: true as const };
}
