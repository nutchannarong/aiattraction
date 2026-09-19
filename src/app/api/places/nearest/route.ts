import { NextResponse, type NextRequest } from "next/server";
import { getNearestArea } from "@/lib/places";

// GET /api/places/nearest?lat=…&lng=… — names a GPS fix or map pin by its district.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  try {
    const area = await getNearestArea(lat, lng);
    if (!area) return NextResponse.json({ error: "พิกัดไม่ถูกต้อง" }, { status: 400 });
    return NextResponse.json({ area });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ระบุพื้นที่ไม่สำเร็จ" }, { status: 502 });
  }
}
