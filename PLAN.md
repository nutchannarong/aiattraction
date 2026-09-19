You can comment on the plan in plan mode, or when Claude asks you to approve it.
แผนพัฒนา "ไทยไหนดี" เป็นระบบวางแผนทริปเต็มรูปแบบ (ตามต้นแบบ ThaiNhaiDee-offline_1.html + ความต้องการ 13 ข้อ)
Context
ผู้ใช้ต้องการเปลี่ยนเว็บจาก "ค้นหาแหล่งท่องเที่ยว" เป็น "ระบบวางแผนทริปขับรถเที่ยว" ตามต้นแบบ ThaiNhaiDee-offline_1.html (สรุปไว้ใน DESIGN.md) พร้อมความต้องการเพิ่มเติม ได้แก่ login ด้วย Facebook/Google/อีเมล, โปรไฟล์ผู้ใช้, ขั้นตอนวางแผนที่แก้แล้ว, เลือกรถและคำนวณค่าน้ำมันจากราคา ปตท., รูปแบบเส้นทาง 5 แบบ, หมุดสถานที่รายทางแยกประเภท, แผนรายวันที่แก้ไขได้, ที่พักพร้อม deep link ไปเว็บจอง, สรุปค่าใช้จ่าย, checklist การจอง และบันทึกแผน

สิ่งที่ผู้ใช้ตัดสินใจแล้ว (19 ก.ย. 2026)

แผนที่: Leaflet + OpenStreetMap ใช้ฟรี (ต่อจากที่ nattkpk ทำไว้) ไม่มีชั้นข้อมูลจราจร
ข้อมูลร้านอาหาร ที่พัก ATM ฯลฯ และการค้นหาสถานที่: OSM อย่างเดียว
ที่พัก: ใช้ deep link ไป Agoda / Booking / Airbnb พร้อมวันที่ จำนวนคน และช่วงราคา ร่วมกับ checklist ผู้ใช้กรอกราคาที่จองจริงเอง
ลำดับงาน: เฟส 1 → 5 ตามแผนนี้ ส่วนเฟส 6 (แผนของฉัน, GPS real-time, เปลี่ยนแผนระหว่างเดินทาง) ทำแค่หน้าเปล่าไว้ก่อน
ข้อจำกัดที่ต้องบอกผู้ใช้ในหน้าเว็บ (ตามหลัก "ซื่อตรงกับข้อมูล" ใน DESIGN.md)

ไม่มีข้อมูลจราจร: เวลาเดินทางเป็นค่าประมาณจาก OSRM บวกตัวคูณตามชนิดรถ
ไม่มีราคาที่พักจริง: ต้องเป็น affiliate ก่อน ส่วน Airbnb ไม่มี API ให้เลย
กลับมาหน้าเราอัตโนมัติไม่ได้: เว็บจองส่งผู้ใช้กลับมาหน้าเราหลังจองไม่ได้ เราทำได้แค่เก็บสถานะไว้ แล้วถามเมื่อผู้ใช้กลับมา
ไม่มีข้อมูลรีวิวหรือรูปจาก Wongnai / Lemon8: ไม่มี API และการดึงข้อมูลเองผิดเงื่อนไขการใช้งาน ใช้ได้แค่ลิงก์ค้นหาไปที่เว็บเหล่านั้น
ภาพ preview:
มีรูปเฉพาะสถานที่ที่ใน OSM ติด tag wikimedia_commons, image หรือ wikidata ไว้ (ดึงจาก Wikimedia ได้ฟรี)
นอกนั้นใช้ภาพประกอบตามหมวดแบบในต้นแบบ พร้อมป้ายบอกว่า "ภาพประกอบตามหมวด"
สิ่งที่ตรวจแล้วว่าใช้ได้จริง

ราคาน้ำมัน ปตท.: SOAP CurrentOilPrice ที่ https://orapiweb.pttor.com/oilservice/OilPrice.asmx คืนราคาของกรุงเทพฯ ครบทุกชนิด (ดีเซล, B20, E20, 91, 95, เบนซิน, Super Power)
ถนนและจุดบริการ: Overpass (kumi) ใช้ได้ และมี pattern การ import ลงฐานข้อมูลอยู่แล้ว (import_roadside_poi)
เส้นทาง: OSRM ใช้ได้ (ตอนนี้ nattkpk เรียกจาก browser ตรง ๆ)
โค้ดที่มีอยู่แล้วและนำมาใช้ต่อ

ตำแหน่งผู้ใช้: useGeolocation, isLocationGranted ใน src/hooks/use-geolocation.ts
พิกัดและระยะทาง: distanceMeters, formatDistance, isValidCoordinates ใน src/lib/geo.ts
Auth:
createAuthClient, getCurrentUser, isAuthProviderEnabled ใน src/lib/supabase-server.ts
server action ใน src/app/login/actions.ts (Google, อีเมล และ safeNext)
/auth/callback และ src/proxy.ts
ข้อมูลสถานที่:
searchAttractions, getAttraction, getNearbyAttractions, htmlToText, toExternalUrl ใน src/lib/attractions.ts
getNearbyRoadside ใน src/lib/roadside.ts
RPC nearby_attractions และ nearby_roadside_poi
ตาราง roadside_poi และ extension postgis กับ http
แผนที่:
AttractionResultsMap ใน src/components/leaflet-map.tsx (Leaflet, OSRM, จุดแวะ)
SearchableSelect ใน src/components/searchable-select.tsx
สภาพอากาศ: getWeather ใน src/lib/weather.ts ใช้แสดงในแผนรายวัน
เฟส 1 — ฐานข้อมูลและธีมตาม DESIGN.md
1A. ธีมและ UI kit
Tokens: อัปเดต src/app/globals.css ตาม DESIGN.md §8.1
เพิ่ม surface-2/3, subtle, border-soft, brand (#F4622E ใช้กับพื้นที่ไม่มีตัวอักษร), accent-soft, secondary-soft, info, highlight
เพิ่ม --shadow-hard, --shadow-active และ --radius-card
พื้นหลังกระดาษลายจุด
รองรับ data-theme เพื่อสลับธีมเอง
ฟอนต์: ใน src/app/layout.tsx เปลี่ยนเป็น next/font/google 3 ตัว: Anuphan, Noto Serif Thai และ IBM Plex Mono
Header: ทำใหม่ตามต้นแบบ
เมนู: วางแผน · ค้นหาสถานที่ · แผนของฉัน · กำลังเดินทาง
UserMenu แสดงชื่อจากโปรไฟล์
มีปุ่มสลับธีม
Component ใหม่ใน src/components/ui/ (kebab-case ตาม STYLE.md) ทั้งหมดใช้สีที่ผ่านคอนทราสต์ตาม DESIGN.md §2.4 และมีพื้นที่กดอย่างน้อย 44px:
sticker-card, button (cta / ghost / mini)
chip, stepper, toggle, badge, callout (warn 4 แบบ)
step-section (accordion มีเลขกำกับ), date-range-picker, stat-tile
ไอคอน: ติดตั้ง lucide-react แทน emoji บนหมุดแผนที่
Routing ใหม่:
/ เป็นหน้า "วางแผน" (hero + ปุ่มเริ่ม)
หน้าค้นหาเดิมย้ายไป /attractions และทำ redirect ให้ URL เก่า /?q= ยังใช้ได้
1B. ฐานข้อมูล (migration ใหม่ใน supabase/migrations/)
provinces: id (= att_province_id), name_th, region_th, is_secondary_city, centroid
ข้อมูลตั้งต้นมาจาก attraction_province_options
รายชื่อ 55 จังหวัดเมืองรองต้องตรวจกับประกาศของกระทรวงการท่องเที่ยวและกีฬาตอนลงมือทำ
attraction_type_group: att_type → หมวด 13 หมวด + ค่าความเหนื่อย (effort) ตาม DESIGN.md §2.2
ทำ view attraction_with_group ไว้ใช้คัดสถานที่
poi (ขยายจาก roadside_poi):
kind ได้แก่ restaurant, cafe, hotel, guest_house, hostel, apartment, resort, museum, atm, pharmacy, hospital, clinic, fuel, rest_area, services, parking, toilets
เก็บ name, name_th, brand, phone, website, opening_hours, stars, cuisine, parking_type, fee, image_url, wikidata, location, address (จาก addr:*)
import ด้วยฟังก์ชัน import_poi(kind_group) ที่แบ่งดึงทีละกลุ่มกันหมดเวลา แล้วย้ายข้อมูล roadside_poi เดิมเข้ามา
ให้ nearby_roadside_poi ยังทำงานได้ (เป็น wrapper หรือ view) เพื่อให้ RoadsideCard กับ /api/roadside ไม่พัง
RPC ใหม่ ทั้งหมดเป็น security invoker:
nearby_poi(lat, lng, kinds text[], radius_m, max_results)
poi_along_route(route geojson, kinds text[], buffer_m, per_kind) ใช้ ST_DWithin กับ LineString ของเส้นทาง
attractions_along_route(route geojson, groups text[], buffer_m, max_results)
search_places(q, near_lat, near_lng, max_results)
ค้นรวมจาก attraction, poi, จังหวัด อำเภอ และตำบล ด้วย pg_trgm
คืนชื่อ ประเภท ที่อยู่ย่อ และพิกัด ให้ผู้ใช้ยืนยันได้ว่าเป็นที่เดียวกัน
ตารางของผู้ใช้: ทุกตารางมี user_id เปิด RLS ให้เจ้าของอ่านและเขียนได้เฉพาะของตัวเอง และตั้ง grant ให้ครบ
profiles: id = auth.users.id, full_name, birth_date, gender, home_province_id, occupation, avatar_url
trips: title, origin, destination (jsonb แบบ {type: province|pin|place, …}), start_date, end_date, travelers, occasion, interests, stop_kinds, vehicle, route_style, route_summary, status (draft / upcoming / active / done)
trip_days: trip_id, day_index, date, finished_at
trip_items:
day_id, position, start_time, end_time, activity
kind (attraction / poi / lodging / rest_stop / custom), place_source, place_id, place_name, lat, lng, address
cost_estimate, cost_category (fuel / travel / admission / food / lodging / other)
phone, opening_hours, notes, lodging (jsonb)
trip_bookings: item_id, night_date, platform, url, price, status (todo / opened / booked / skipped), booked_at
ราคาน้ำมัน: สร้าง src/lib/fuel.ts เรียก SOAP ของ ปตท. ฝั่ง server
cache ด้วย fetch(…, { next: { revalidate: 86400 } }) และแปลง XML เป็น {product, price, date}[]
ถ้าเรียกไม่สำเร็จ ใช้ราคาตั้งต้น และบอกผู้ใช้ว่าไม่ใช่ราคาสด
ตรวจสอบ: รัน get_advisors (security) หลังทำ migration ทุกครั้ง
เฟส 2 — Login และ User Profile
Facebook login: เพิ่ม signInWithFacebook ใน src/app/login/actions.ts ใช้ pattern เดียวกับ Google (เช็ค isAuthProviderEnabled("facebook") ก่อน)
ปุ่มบนหน้า login จัดตาม DESIGN.md §4.4
ผู้ใช้ต้องสร้าง Meta App แล้วเปิด provider ใน Supabase เอง จะเขียนขั้นตอนลง README
สมัครด้วยอีเมล: มีอยู่แล้ว แก้เพิ่มแค่หน้าตาและข้อความ
หน้า /profile: ฟอร์มกรอกชื่อ-นามสกุล, วันเกิด (date picker), เพศ (ชาย / หญิง / อื่น ๆ / ไม่ระบุ), จังหวัดบ้านเกิด (SearchableSelect จาก provinces พร้อมป้ายเมืองหลัก/เมืองรอง), อาชีพ
บันทึกผ่าน server action พร้อมตรวจข้อมูลด้วย zod
หลัง login ครั้งแรก: ถ้ายังไม่มีโปรไฟล์ ให้ callback พาไป /profile?next=…
ข้อมูลจาก Google/Facebook: ใช้ชื่อและรูปมาเติมในโปรไฟล์ให้ล่วงหน้า
ใช้โปรไฟล์ในการวางแผน:
อายุจากวันเกิด ช่วยเลือกช่วงวัยให้ล่วงหน้า
จังหวัดบ้านเกิดเสนอเป็นปลายทางแบบ "กลับบ้าน" ตามต้นแบบ
เฟส 3 — ขั้นตอนวางแผน 5 ขั้น (/plan)
ร่างแผนระหว่างกรอก: เก็บใน client state + localStorage เพื่อให้คนที่ยังไม่ login วางแผนได้ ต้อง login ตอนบันทึกเท่านั้น
type PlannerDraft อยู่ใน src/lib/planner/types.ts
ขั้น 1: จะไปไหน เมื่อไร
ต้นทางและปลายทาง มี 3 วิธี: เลือกจังหวัด, ปักหมุดจาก GPS หรือบนแผนที่, หรือพิมพ์ค้นหาสถานที่ผ่าน search_places ที่แสดงชื่อ ที่อยู่ และแผนที่เล็กให้ยืนยัน
จังหวัดมีป้าย เมืองหลัก / เมืองรอง
วันเดินทางไปและกลับใช้ date-range-picker
ขั้น 2: เดินทางไปกับใคร (แก้ช่วงอายุตามที่ผู้ใช้แจ้ง)
จำนวนผู้ใหญ่ (18–59), เด็ก (ต่ำกว่า 18), ผู้สูงอายุ (60 ขึ้นไป) ใช้ stepper
ผู้ใหญ่เลือกช่วงวัยย่อยได้หลายช่วง: 18–22 วัยรุ่น/มหาวิทยาลัย · 23–30 วัยทำงานเริ่มต้น · 31–45 วัยสร้างครอบครัว · 46–59 วัยมั่นคง
โอกาสในการเดินทาง: ไปกับคู่รัก / เพื่อน / ครอบครัว / พาพ่อแม่ผู้สูงอายุเที่ยว / เที่ยวคนเดียว
ขั้น 3: ไปแนวไหน เลือกหมวดสถานที่ 13 หมวดพร้อมประเภทย่อย และมีสวิตช์ "สมดุลทุกวัย" ตัดข้อย่อย "ไปกับใคร" ออก ตามที่ผู้ใช้สั่ง
ขั้น 4: อยากแวะที่แบบไหน ร้านอาหาร, คาเฟ่, ที่พัก, วัด, แหล่งท่องเที่ยว, จุดพักรถ, ปั๊มน้ำมัน, ห้องน้ำ, ที่จอดรถ, อื่น ๆ
ขั้น 5: เดินทางด้วยอะไร
ประเภทรถ: มอเตอร์ไซค์, อีโคคาร์, รถเก๋ง 4–5 ที่นั่ง, SUV 5–7 ที่นั่ง, กระบะ, รถตู้, รถทัวร์/รถบัส
รายละเอียด: ยี่ห้อและรุ่น (รายการรถยอดนิยมในไทยเก็บเป็นไฟล์ src/lib/planner/vehicles.ts), ขนาดเครื่องยนต์ (cc), ปีของรถ, ชนิดเชื้อเพลิง
ราคาน้ำมัน: ดึงจาก src/lib/fuel.ts แก้เองได้ และแสดงวันที่ของราคา
อัตราสิ้นเปลือง (กม./ลิตร): ประมาณจากประเภทรถ cc และปี ไว้ใน src/lib/planner/fuel-economy.ts
รูปแบบเส้นทาง 5 แบบ:
เส้นทางหลัก เน้นเร็ว: OSRM แบบปกติ
ชมวิวธรรมชาติ: ไม่ใช้มอเตอร์เวย์ (exclude=motorway) และแทรกจุดผ่านจากหมวด nature / view / mountain / sea ตามแนวเส้นทาง
ชุมชน: ไม่ใช้มอเตอร์เวย์ และแทรกจุดผ่านจากหมวด local / market / farm
ผสมผสาน: ใช้ทางหลักเป็นแกน แล้วแวะชุมชนราว 1–2 จุดต่อวัน
กำหนดเอง: ลากจุดผ่านบนแผนที่ได้อิสระ แล้วให้ OSRM จับเข้ากับถนน
มอเตอร์ไซค์บังคับใช้ exclude=motorway เพราะกฎหมายไทยห้ามขึ้นมอเตอร์เวย์
เส้นทางคำนวณฝั่ง server: สร้าง src/app/api/route/route.ts เป็นตัวกลางไปหา OSRM
ตรวจพิกัดด้วย isValidCoordinates และจำกัดจำนวนจุดผ่าน
cache ผลตาม key ของชุดพิกัด
ถ้าล้มเหลว ให้ขึ้นข้อความแจ้ง ไม่เงียบหายเหมือนตอนนี้
leaflet-map.tsx ต้องเปลี่ยนมาเรียกตัวกลางนี้ และเลิกใช้ MOCK_ORIGIN
ตัวสร้างแผนอัตโนมัติ (src/lib/planner/): เป็น TypeScript ล้วน ทดสอบได้
scoreCandidates: ให้คะแนนสถานที่ตามหมวดที่สนใจ ช่วงวัย โอกาส และค่าความเหนื่อย
buildSchedule: แบ่งวันตามเวลาขับต่อวัน และเพิ่มจุดพัก
estimateCosts: คำนวณค่าน้ำมัน และค่าเข้าชมจาก att_fee_th / att_fee_th_kid ตามจำนวนคน
เฟส 4 — ร่างแผนการเดินทาง: ผลลัพธ์ แผนที่ และหมุดรายทาง
Stat tiles:
ระยะทาง (กม.)
เวลารวมเป็น วัน / ชั่วโมง / นาที (เวลาขับ OSRM × ตัวคูณตามชนิดรถ และแบ่งตามชั่วโมงขับต่อวัน)
จำนวนจุดแวะ ค่าน้ำมัน และค่าใช้จ่ายรวม
แผนที่ Leaflet: ปรับ leaflet-map.tsx ให้หน้าตาเป็นแบบสติกเกอร์
แสดงเส้นทางสีแบรนด์
หมุดแยกประเภทชัดเจนด้วยไอคอนจาก lucide-react และสีตามหมวด: ร้านอาหาร, ที่พัก, พิพิธภัณฑ์, ATM, ปั๊มน้ำมัน, ร้านขายยา, โรงพยาบาล, คาเฟ่, อื่น ๆ
มีแผงเปิด-ปิดชั้นข้อมูลแต่ละประเภท
ดึงหมุดจาก poi_along_route แทน /api/roadside ที่ใช้จุดตัวอย่าง 12 จุด
โหมดกำหนดเอง: ปุ่มเครื่องมือตามต้นแบบ (ลากเส้นทางเอง, ย้อนกลับ, ทำซ้ำ, เรียงจุด, ล้าง) ลากหมุดได้ และมีรายการจุดผ่าน (wpchip)
ไม่มีข้อมูลจราจร: เขียนแจ้งใน callout ว่า "เวลาเป็นค่าประมาณ ไม่รวมสภาพจราจร"
ปุ่มเปิดใน Google Maps: ส่งจุดผ่านทั้งหมดไปด้วย (สร้างลิงก์จากต้นทางจริง ไม่ใช้กรุงเทพฯ แบบตายตัว)
หน้า /map เดิม: redirect ไป /plan ส่วนหน้ารายละเอียดสถานที่ให้ปุ่ม "วางแผนไปที่นี่" ส่งปลายทางเข้า /plan เลย
เฟส 5 — แผนรายวัน ที่พัก สรุป และ checklist
แผนรายวัน: ในหน้า /plan หลังผลลัพธ์ แต่ละวันเป็นการ์ด
แถวแรกของวันเป็นแถวว่างที่มีปุ่ม + กดแล้วเปิดฟอร์มรายการ ประกอบด้วย:
เวลาเริ่มและจบ
กิจกรรม
สถานที่: ค้นหาแบบ Google ผ่าน search_places แสดงชื่อ ประเภท ที่อยู่ย่อ และแผนที่เล็กให้ยืนยันก่อนเลือก
ค่าใช้จ่ายโดยประมาณและหมวดค่าใช้จ่าย
เวลาเปิด-ปิด (จาก att_start_end หรือ opening_hours ของ OSM) พร้อมเตือนถ้าปิดในวันและเวลาที่เลือก
เบอร์โทร
ที่จอดรถแนะนำ (จาก nearby_poi แบบ parking แยกประเภท: ลานจอด / อาคารจอด / ริมถนน และฟรีหรือเสียเงิน)
กด + เพิ่มกิจกรรมได้เรื่อย ๆ
ปุ่มเพิ่มจุดแวะพักรถ: เสนอปั๊มน้ำมัน คาเฟ่ ที่จอดรถชั่วคราว และห้องน้ำ ที่อยู่ใกล้รายการก่อนหน้า
ปุ่ม "จบกิจกรรมวันนี้": บันทึกวันนั้น (trip_days.finished_at)
ปุ่ม "เปลี่ยนแผน" บนแต่ละรายการ: ใช้ GPS ปัจจุบัน หรือพิกัดของรายการถ้าไม่มี GPS หาสถานที่ประเภทเดียวกันที่ใกล้ที่สุดผ่าน nearby_poi หรือ nearby_attractions ตามหมวด เลือกแล้วแทนที่รายการเดิม
ลิงก์รีวิว: ปุ่มค้นหาชื่อสถานที่ใน Google Maps, Wongnai และ Lemon8 เป็นลิงก์ออกไปภายนอก
ที่พัก:
เลือกประเภท: หอพัก / อพาร์ตเมนต์ / ห้องพักรายวัน / ห้องพักรายชั่วโมง / โรงแรม / รีสอร์ท / อื่น ๆ
ค้นหาชื่อ หรือดูที่พักแนะนำใกล้จุดสุดท้ายของวัน (ข้อมูลจาก OSM)
ตัวกรอง: ราคาต่ำสุด-สูงสุด, ดาว, ข้อจำกัด เช่น ที่จอดรถ สัตว์เลี้ยง อาหารเช้า
เลือกที่พักแล้ว แสดงช่องทางจอง: Agoda, Booking, Airbnb และจองตรง (โทรหรือเว็บไซต์จาก OSM)
แต่ละช่องทางเป็น deep link ที่ใส่ชื่อที่พัก วันเข้าและออก จำนวนคน และช่วงราคาไว้ให้
ราคาต่อช่องทางให้ผู้ใช้กรอกเอง เพราะไม่มี API ราคา
สรุปค่าใช้จ่าย เมื่อทุกวันกดจบแล้ว:
ค่าน้ำมันและค่าเดินทาง, ค่าเข้าชม, ค่าอาหาร, ค่าที่พัก, อื่น ๆ, รวมทั้งหมด
แสดงยอดต่อคนด้วย
Checklist การจอง:
รายการที่พักแยกตามคืน: คืนไหน พักที่ไหน ราคาแต่ละ platform และจะจองผ่านไหน
กดจองแล้วเปิดแท็บใหม่ และตั้งสถานะเป็น "เปิดแล้ว"
เมื่อผู้ใช้กลับมาที่แท็บเรา (event visibilitychange / focus) ถามว่า "จองคืนที่ X เสร็จแล้วไหม"
ตอบว่าเสร็จ: บันทึกเป็น booked พร้อมราคา แล้วเลื่อนไปคืนถัดไปอัตโนมัติ ไม่ต้องเริ่มใหม่
แสดงความคืบหน้า เช่น "จองแล้ว 2/4 คืน" และรายการที่ยังค้าง
ปุ่ม "สร้างแผนของฉัน": บันทึก trips, trip_days, trip_items และ trip_bookings ด้วยสถานะ upcoming (ต้อง login ถ้ายังไม่ได้ login จะพาไป /login?next=/plan และเก็บร่างแผนไว้)
เฟส 6 — ทำแค่หน้าเปล่าไว้ก่อน
/trips (แผนของฉัน): หน้าเปล่าพร้อมข้อความ "กำลังพัฒนา"
/trips/[id]/live (กำลังเดินทาง): หน้าเปล่าเช่นกัน
สิ่งที่จะทำทีหลัง:
รายการทริปที่จะถึง
ปุ่มเริ่มแผน
GPS แบบ real-time ด้วย watchPosition
นำทางไปจุดถัดไป
เปลี่ยนแผนระหว่างเดินทาง
ไฟล์หลักที่จะแก้หรือสร้าง
ธีมและโครงหน้า: src/app/globals.css, src/app/layout.tsx, src/components/ui/*, src/components/site-header.tsx
หน้าวางแผน: src/app/page.tsx (hero วางแผน), src/app/attractions/page.tsx (หน้าค้นหาที่ย้ายมา), src/app/plan/*
Profile และหน้าเปล่า: src/app/profile/*, src/app/trips/* (หน้าเปล่า)
Auth: src/app/login/actions.ts (Facebook), src/app/auth/callback/route.ts (พาไปกรอกโปรไฟล์)
API: src/app/api/route/route.ts, src/app/api/places/route.ts
Logic ใน src/lib/: fuel.ts, places.ts, poi.ts, trips.ts, profile.ts, planner/{types,vehicles,fuel-economy,scoring,schedule,costs,booking-links}.ts
แผนที่: src/components/leaflet-map.tsx (ปรับให้รับต้นทางจริง ใช้ /api/route แสดงหมุดหลายประเภท และมีโหมดวาดเส้นทางเอง)
ฐานข้อมูล: supabase/migrations/2026091907…_provinces_profiles_trips.sql, …_poi.sql
เอกสาร: README.md (ตั้งค่า Facebook, import POI), STYLE.md (UI kit), DESIGN.md (สิ่งที่เปลี่ยนจากต้นแบบ เช่น ช่วงอายุ)
Dependencies ใหม่: lucide-react, zod
Verification (ทุกเฟส)
Build: npm run lint, npm run build และ npx tsc --noEmit ต้องผ่าน
ฐานข้อมูล:
รัน get_advisors (security) หลังทุก migration
ทดสอบ RLS ด้วย SQL set role authenticated + request.jwt.claims ของผู้ใช้ 2 คน ว่าอ่านทริปของกันไม่ได้
ลองเขียนด้วย anon ต้องถูกปฏิเสธ
ฟังก์ชันใน src/lib/planner/*: เป็น pure function ตรวจด้วยสคริปต์ node ตัวอย่างข้อมูล หรือเพิ่ม vitest ถ้าทีมต้องการ
ทดสอบใน browser pane:
กรอกครบ 5 ขั้น (จำลอง geolocation) ได้เส้นทางและหมุดแต่ละประเภท
เพิ่ม ลบ และเปลี่ยนแผนรายการในแผนรายวัน
เลือกที่พักแล้วได้ deep link ครบ 3 เว็บ
checklist เลื่อนไปคืนถัดไปเมื่อกลับมาที่แท็บ
สรุปค่าใช้จ่ายรวมถูกต้อง
บันทึกทริปแล้วเห็นแถวในฐานข้อมูล
ราคาน้ำมัน: src/lib/fuel.ts คืนราคาจริงจาก ปตท. และถ้าเรียกไม่สำเร็จต้องใช้ราคาตั้งต้นพร้อมข้อความแจ้ง
ทุกเฟส: commit แยกเฟสละก้อน แล้ว git pull --rebase ก่อน push (nattkpk push เข้า main ด้วย) และตรวจว่า Vercel deploy ผ่าน