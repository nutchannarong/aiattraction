import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboard } from "../src/lib/admin/reports.ts";
import { buildAdminAiContext } from "../src/lib/admin/ai-context.ts";

const range = { from: "2026-09-01", to: "2026-09-02" };
const empty = () => ({
  profiles: [],
  trips: [],
  events: [],
  sessions: [],
  provinces: [
    { id: "1", name_th: "กรุงเทพมหานคร" },
    { id: "2", name_th: "เชียงใหม่" },
  ],
  groups: [],
});

const sampleTrip = {
  id: "t1",
  user_id: "u1",
  created_at: "2026-09-01T10:00:00Z",
  start_date: "2026-10-01",
  end_date: "2026-10-03",
  status: "upcoming",
  origin: { province_id: "1" },
  destination: { province_id: "2" },
  travelers: { adults: 2, children: 1, seniors: 0 },
  occasion: "family",
  interests: ["nature"],
  vehicle: { type: "sedan", fuel: "gasohol_95" },
  route_style: "fastest",
  route_summary: { distance_km: 700, fuel_units: 50, fuel_cost: 2000 },
  trip_days: [],
};

test("buildAdminAiContext generates structured analytics summary with key sections", () => {
  const input = empty();
  input.trips = [sampleTrip];
  input.profiles = [
    {
      id: "p1",
      birth_date: "1995-05-15",
      gender: "male",
      occupation: "engineer",
      home_province_id: "1",
      created_at: "2026-09-01T08:00:00Z",
    },
  ];

  const dashboard = buildDashboard(input, range);
  const context = buildAdminAiContext(dashboard, range);

  assert.ok(typeof context === "string");
  assert.ok(context.includes("THAINHAIDEE ADMIN"));
  assert.ok(context.includes("2026-09-01 ถึง 2026-09-02"));
  assert.ok(context.includes("1 ทริป"));
  assert.ok(context.includes("1 คน"));
  assert.ok(context.includes("[1. ภาพรวมการใช้งานและกิจกรรม (Overview Metrics)]"));
  assert.ok(context.includes("[2. พฤติกรรมและรูปแบบทริป (Trip Patterns)]"));
  assert.ok(context.includes("[3. การเงินและงบประมาณประมาณการ (Financial Projections)]"));
  assert.ok(context.includes("[4. ยานพาหนะและพลังงาน (Vehicle & Energy)]"));
  assert.ok(context.includes("[ข้อจำกัดและความหมายของข้อมูล (Data Caveats)]"));
  assert.ok(context.includes("เชียงใหม่"));
});
