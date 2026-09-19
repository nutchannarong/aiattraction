"use server";

import { z } from "zod";
import { buildTripPlan, PlanError } from "@/lib/planner/build";
import type { TripPlan } from "@/lib/planner/plan-types";
import type { PlannerDraft } from "@/lib/planner/types";

const lat = z.number().min(4).max(22);
const lng = z.number().min(96).max(107);

const placeSchema = z.object({ label: z.string().max(200), latitude: lat, longitude: lng }).loose();

// Only the fields the server relies on are checked strictly; the rest passes through.
const draftSchema = z
  .object({
    version: z.literal(1),
    origin: placeSchema,
    destination: placeSchema,
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    travelers: z.object({
      adults: z.int().min(0).max(100),
      children: z.int().min(0).max(100),
      seniors: z.int().min(0).max(100),
      adultAges: z.array(z.enum(["18-22", "23-30", "31-45", "46-59"])).max(4),
    }),
    occasion: z.enum(["couple", "friends", "family", "parents", "solo"]).nullable(),
    interests: z.array(z.string().max(20)).max(13),
    interestTypes: z.array(z.int()).max(100),
    balanced: z.boolean(),
    stopKinds: z.array(z.string().max(20)).max(20),
    vehicle: z
      .object({
        type: z.enum(["motorcycle", "eco_car", "sedan", "suv", "pickup", "van", "bus"]),
        fuelPrice: z.number().min(0).max(1000),
        efficiencyOverride: z.number().min(0.1).max(200).nullable(),
        cc: z.number().min(0).max(20000).nullable(),
        year: z.int().min(1950).max(2100).nullable(),
      })
      .loose(),
    routeStyle: z.enum(["fastest", "scenic", "community", "mixed", "custom"]),
    customWaypoints: z.array(z.object({ lat, lng })).max(15),
  })
  .loose()
  .refine((d) => d.endDate >= d.startDate, "วันกลับต้องไม่ก่อนวันออกเดินทาง")
  .refine(
    (d) => d.travelers.adults + d.travelers.children + d.travelers.seniors > 0,
    "ต้องมีผู้เดินทางอย่างน้อย 1 คน",
  );

export type DraftPlanResult = { plan: TripPlan } | { error: string };

export async function draftTripPlan(input: PlannerDraft): Promise<DraftPlanResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบหรือไม่ถูกต้อง" };
  }
  try {
    return { plan: await buildTripPlan(input) };
  } catch (error) {
    if (error instanceof PlanError) return { error: error.message };
    console.error(error);
    return { error: "ร่างแผนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}
