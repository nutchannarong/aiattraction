import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/places";

// GET /api/places?q=…&lat=…&lng=… — place search for the planner's pickers.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  try {
    const items = await searchPlaces(q, sp.has("lat") ? { lat, lng } : null);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ items: [], error: "ค้นหาไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }
}
