import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, dateRange, validDate, bangkokDate } from "../src/lib/admin/reports.ts";

const range = { from: "2026-09-01", to: "2026-09-02" };
const empty = () => ({ profiles: [], trips: [], events: [], sessions: [], provinces: [], groups: [] });
const trip = (patch = {}) => ({ id: "t1", user_id: "u1", created_at: "2026-09-01T00:00:00Z", start_date: "2026-10-01", end_date: "2026-10-03", status: "upcoming", origin: {province_id:"1"}, destination: {province_id:"2"}, travelers: {adults:2,children:1,seniors:0}, occasion:"family", interests:["sea"], vehicle:{type:"sedan",fuel:"gasohol_95"}, route_style:"fastest", route_summary:{distance_km:100,fuel_units:10,fuel_cost:400}, trip_days:[], ...patch });
const chart = (data,id) => data.sections.flatMap(s=>s.charts).find(c=>c.id===id);

test("valid calendar ranges and Thai midnight boundaries", () => {
  assert.equal(validDate("2026-02-30"),false);
  assert.equal(validDate("2026-02-28"),true);
  assert.equal(bangkokDate("2026-08-31T17:00:00Z"),"2026-09-01");
  assert.deepEqual(dateRange("2026-09-03","2026-09-02"), {from:"2026-08-04",to:"2026-09-02"});
});
test("DAU deduplicates sessions and events; includes zero-activity dates", () => {
  const input=empty();
  input.sessions=[{id:"s1",user_id:"u1",started_at:"2026-08-31T17:00:00Z",active_seconds:120}];
  input.events=[{id:1,user_id:"u1",created_at:"2026-09-01T00:00:00Z",kind:"login",provider:"google"},{id:2,user_id:"u2",created_at:"2026-09-01T01:00:00Z",kind:"login",provider:"facebook"}];
  const data=buildDashboard(input,range);
  assert.deepEqual(chart(data,"dau").rows.map(r=>r.value),[2,0]);
  assert.equal(chart(data,"mau").rows[0].value,2);
  assert.equal(data.overview.find(m=>m.label==="DAU เฉลี่ย").value,"1");
  assert.equal(data.overview.find(m=>m.label==="Stickiness").value,"50%");
});
test("reports use saved cohort, real province mapping, and all-finished days", () => {
  const input=empty(); input.provinces=[{id:"1",name_th:"กรุงเทพมหานคร"},{id:"2",name_th:"เชียงใหม่"}];
  input.trips=[trip({trip_days:[{day_index:0,date:"2026-10-01",finished_at:"2026-10-01T10:00:00Z",trip_items:[{kind:"drive",start_time:"06:30:00",cost_estimate:400,cost_category:"fuel"}]}]}),trip({id:"t2",created_at:"2026-08-01T00:00:00Z"})];
  const data=buildDashboard(input,range);
  assert.equal(data.trips,1); assert.equal(chart(data,"destination").rows[0].label,"เชียงใหม่");
  assert.equal(chart(data,"funnel").rows.at(-1).value,1);
  assert.equal(chart(data,"funnel").rows[2].value,0);
  assert.equal(chart(data,"hours").rows[6].value,1);
  assert.equal(data.patternStats.find(m=>m.label==="ค่าใช้จ่ายเฉลี่ย / ทริป").value,"400 ฿");
  assert.equal(chart(data,"frequency").rows[0].label,"2 ทริป");
});
test("does not combine kWh or kilograms with litres", () => {
  const input=empty();input.trips=[trip(),trip({id:"ev",vehicle:{fuel:"ev"},route_summary:{fuel_units:100,fuel_cost:700,distance_km:200}})];
  const data=buildDashboard(input,range);
  assert.equal(data.vehicleStats.find(m=>m.label==="เชื้อเพลิงรวม").value,"10 ลิตร");
  assert.equal(data.vehicleStats.find(m=>m.label==="ค่าพลังงานเฉลี่ย / ทริป").value,"550 ฿");
});
test("empty reports have no invented activity or completed trips", () => {
  const data=buildDashboard(empty(),range);
  assert.equal(data.trips,0); assert.equal(data.overview.find(m=>m.label==="Stickiness").value,"—");
  assert.equal(data.sections.flatMap(s=>s.charts).flatMap(c=>c.rows).reduce((s,r)=>s+r.value,0),0);
});
test("age uses birthday at range end; purpose stays separate from companion", () => {
  const input=empty(); input.profiles=[{id:"u",created_at:"2026-09-01T00:00:00Z",birth_date:"2003-09-03",gender:"female",occupation:null,home_province_id:null}];
  input.trips=[trip({route_summary:{travel_purpose:"festival"}})];
  const data=buildDashboard(input,range);
  assert.equal(chart(data,"age").rows[0].label,"18–22");
  assert.equal(chart(data,"occasion").rows[0].label,"เทศกาล / ประเพณี");
  assert.equal(chart(data,"companions").rows[0].label,"ครอบครัว · มีเด็ก");
});
test("destination province resolves from sublabel or label when province_id is null", () => {
  const input = empty();
  input.provinces = [{ id: "1006", name_th: "ขอนแก่น" }, { id: "1014", name_th: "เชียงใหม่" }];
  input.trips = [
    trip({
      origin: { label: "เชียงใหม่", province_id: "1014" },
      destination: { label: "พัทยา 2", sublabel: "ภูเวียง · ขอนแก่น", province_id: null },
    }),
  ];
  const data = buildDashboard(input, range);
  assert.equal(chart(data, "destination").rows[0].label, "ขอนแก่น");
  assert.equal(chart(data, "routes").rows[0].label, "เชียงใหม่ → ขอนแก่น");
});

