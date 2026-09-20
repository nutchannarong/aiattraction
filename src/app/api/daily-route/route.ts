import { z } from "zod";
import { roadRoute } from "@/lib/routing";

const requestSchema = z.object({
  points: z
    .array(
      z.object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      }),
    )
    .min(2)
    .max(20),
});

/** Returns the drivable road geometry for the stops shown in one daily map. */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ข้อมูลจุดหมายไม่ถูกต้อง" }, { status: 400 });

  const route = await roadRoute(parsed.data.points, { costing: "auto", avoidHighways: false });
  if (!route) return Response.json({ error: "ยังคำนวณเส้นทางถนนไม่ได้" }, { status: 503 });

  return Response.json(
    { coordinates: route.coordinates, distanceKm: route.distanceKm, durationMin: route.durationMin },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
