# Admin dashboard

หน้า `/admin` ใช้บัญชี `admin` และรหัสผ่านที่เจ้าของโครงการกำหนด (`thainhaidee`) ตรวจ hash ด้วย scrypt ฝั่งเซิร์ฟเวอร์ ไม่มีรหัสผ่านหรือ secret key ใน client bundle

## ติดตั้ง

1. รัน `supabase/migrations/20260920090000_admin_analytics.sql` ใน Supabase SQL Editor ของโปรเจกต์เดียวกับเว็บไซต์ หลัง migrations เดิมทั้งหมด
2. เพิ่ม `SUPABASE_SECRET_KEY` (หรือ `SUPABASE_SERVICE_ROLE_KEY`) ใน `.env.local` และ Vercel Environment Variables ของ environment ที่ต้องการ ห้ามใช้ prefix `NEXT_PUBLIC_`
3. สร้าง `ADMIN_SESSION_SECRET` ด้วย `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` แล้วตั้งค่าในทั้งสอง environment ใช้ค่าแยกกันได้ ห้าม commit ค่า secret
4. รีสตาร์ต local dev / redeploy บน Vercel แล้วเปิด `/admin`

รายงานต้องใช้ key ฝั่งเซิร์ฟเวอร์เพราะ RLS ของข้อมูลสมาชิกอนุญาตให้สมาชิกอ่านเฉพาะข้อมูลตัวเอง ไม่ต้องปิด RLS หรือให้ anon อ่านรายงาน บัญชีแอดมินนี้แยกจาก Supabase Auth และไม่ได้สร้างสมาชิกชื่อ admin ในฐานข้อมูล

## สิทธิ์และ session

- ทั้งหน้า dashboard, ตัวโหลดข้อมูล และ CSV ตรวจ admin session ฝั่งเซิร์ฟเวอร์
- Cookie HttpOnly, SameSite=Strict, Secure บน production, จำกัด path `/admin`, อายุ 8 ชั่วโมง; HMAC ตรวจการแก้ไข token
- ฐานข้อมูลจำกัดการพยายาม login 10 ครั้ง / 15 นาที / IP (เก็บ hash ของ IP) ใช้ Vercel trusted forwarded header บน production หากใช้ reverse proxy อื่นต้องให้ proxy เขียนทับ header นี้
- RPC rate limiter และตาราง analytics อ่านได้เฉพาะ service role; member ส่ง telemetry ของตัวเองได้ผ่าน RPC ที่กำหนด identity และเวลาเอง
- เปลี่ยน ADMIN_SESSION_SECRET เพื่อยกเลิก session แอดมินทั้งหมด
- ไม่มีการ cache รายงานข้ามผู้ใช้; CSV เป็นข้อมูลรวมพร้อม UTF-8 BOM และป้องกันสูตร spreadsheet

## รายงานตาม PDF

ภาพรวม: login รายวันแยก provider หลัก, DAU, MAU, เวลาใช้งาน, จำนวนร่างแผน/บันทึก/ออกเดินทาง/จบครบวัน

ผู้ใช้: เพศ อายุ อาชีพ จังหวัดบ้านเกิด

ปลายทาง: จังหวัดต้นทาง/ปลายทาง และคู่เส้นทาง

ช่วงเวลา: heatmap วัน × ชั่วโมง, ชั่วโมง, วันในสัปดาห์, เดือน, ปี จากเวลาเริ่มขับรถในแผน

รูปแบบทริป: ผู้ร่วมเดินทาง ความสนใจ โอกาสเดินทาง (เพิ่มตัวเลือกไม่บังคับในแบบฟอร์ม) หมวดจุดแวะ จำนวนวัน/คน ความถี่ใน 365 วัน ค่าใช้จ่ายและความถี่เฉลี่ย

ยานพาหนะ: ประเภท ยี่ห้อ อายุรถ cc เชื้อเพลิง เส้นทาง ระยะทางและค่าพลังงาน

ทุกกราฟมีตารางข้อมูลและส่งออก CSV ได้ โดยเลือกช่วงวันที่สูงสุด 366 วัน เวลาไทย

## วิธีนับและข้อจำกัด

- ตัวเลขมาจากข้อมูลจริงเท่านั้น ไม่มี mock fallback หากฐานข้อมูลไม่พร้อมแสดงข้อผิดพลาดแทนศูนย์
- สมาชิก/ทริปกรองตาม created_at; ช่วงเวลาเดินทางอิงวันและเวลาตามแผนของ cohort ทริปนั้น
- telemetry เริ่มหลังติดตั้ง เฉพาะสมาชิกที่ login แล้ว ไม่มีข้อมูลย้อนหลังก่อนติดตั้ง และไม่นับการร่างแผนของ guest
- activity heartbeat ทุก 30 วินาทีขณะแท็บมองเห็น เป็นเวลาประมาณ session ไม่ใช่การจับเวลาการเคลื่อนไหวของผู้ใช้
- DAU เป็นสมาชิกไม่ซ้ำต่อวัน; MAU เป็นสมาชิกไม่ซ้ำต่อเดือนภายในช่วงเลือก (ถ้าเลือกไม่ครบเดือนจะเป็นเดือนบางส่วน)
- การเข้าใช้ OAuth จัดกลุ่มตาม provider หลักของบัญชี จึงอาจต่างจาก provider ล่าสุดในกรณีผูกหลายบัญชี
- จำนวนร่างแผนนับ event แต่จำนวนบันทึก/active/done นับ cohort ทริป ไม่แสดง conversion/drop-off ที่เชื่อมกันไม่ได้
- ระบบเดิม `/trips` และ `/live` ยังเป็น ComingSoon จึงยังไม่มีการกดเริ่มทริปจริง รายงานใช้ trips.status=active/done เมื่อมีข้อมูล และ finished_at ของทุกวันหรือสถานะ done สำหรับทริปที่จบ
- ไม่ตีความการกดเปิด Google Maps เป็นการออกเดินทางจริง
- แผนเก่าที่ไม่มี travel_purpose หรือ province_id แสดง “ไม่ระบุ”
- เชื้อเพลิงหน่วยลิตรไม่รวม NGV (กก.) และ EV (kWh); ค่าใช้จ่ายเป็นประมาณการจากแผน ไม่ใช่รายรับหรือยอดจ่ายจริง
- อ่านแบบแบ่งหน้า 500 แถว ไม่ตัดเงียบที่ค่า default ของ Supabase; เกิน 50,000 แถวต่อแหล่งข้อมูลแสดงข้อผิดพลาด ควรย้าย aggregation ลง SQL เมื่อข้อมูลโต

## ตรวจสอบ

`node --experimental-strip-types --test tests/admin-reports.test.mjs tests/admin-session.test.mjs`

`npm run lint` และ `npx tsc --noEmit` (ใช้ `npx next typegen` ก่อน หากเพิ่ม route แล้ว types เก่า)
