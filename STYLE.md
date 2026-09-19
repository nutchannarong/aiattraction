# AI Attraction — Coding & UI Style Guide

เอกสารนี้กำหนดแนวทางการเขียนโค้ดและออกแบบ UI สำหรับโปรเจกต์ AI Attraction โดยยึดรูปแบบที่มีอยู่ในโค้ดปัจจุบันเป็นหลัก เพื่อให้โค้ดใหม่อ่านง่าย สม่ำเสมอ และดูแลต่อได้ง่าย

## 1. รูปแบบการตั้งชื่อไฟล์และตัวแปร

### 1.1 ไฟล์และโฟลเดอร์

- ใช้ตัวพิมพ์เล็กและ kebab-case สำหรับไฟล์ Component และ utility เช่น `weather-card.tsx`, `attraction-map.tsx`
- ใช้โครงสร้างของ Next.js App Router ตามตำแหน่งมาตรฐาน:
  - `src/app/` สำหรับ route, layout, loading และ not-found
  - `src/components/` สำหรับ Component ที่ใช้ร่วมกัน
  - `src/lib/` สำหรับ data access, API integration, parser และ business logic
  - `supabase/migrations/` สำหรับ SQL migration โดยใช้ชื่อขึ้นต้นด้วย timestamp
- ชื่อ route แบบ dynamic ใช้รูปแบบของ Next.js เช่น `src/app/attractions/[id]/page.tsx`
- ไฟล์เอกสารระดับโปรเจกต์ใช้ตัวพิมพ์ใหญ่ เช่น `README.md`, `AGENTS.md`, `STYLE.md`
- ไม่สร้างไฟล์ซ้ำหน้าที่กัน เช่น อย่าวาง query Supabase ไว้ทั้งใน `page.tsx` และ `src/lib/attractions.ts`

### 1.2 ตัวแปร ฟังก์ชัน และ Type

- ใช้ `camelCase` สำหรับตัวแปร ฟังก์ชัน และ prop เช่น `searchAttractions`, `pageCount`, `mapUrl`
- ใช้ `PascalCase` สำหรับ React Component และ type ที่เป็น object เช่น `WeatherCard`, `AttractionSummary`
- ใช้ `UPPER_SNAKE_CASE` สำหรับค่าคงที่ระดับ module ที่ไม่เปลี่ยน เช่น `PAGE_SIZE`, `REVALIDATE_SECONDS`
- ชื่อฟังก์ชันควรสื่อการกระทำ เช่น `getAttraction`, `getFilterOptions`, `toExternalUrl`
- ชื่อ boolean ควรอ่านเป็นคำถามหรือสถานะ เช่น `hasMap`, `hasValidCoordinates`
- ใช้ชื่อ field จากฐานข้อมูลตาม schema เมื่อทำงานกับ data layer เช่น `att_name_th`, `province_name_th`
- เมื่อส่งข้อมูลจาก data layer ไปยัง UI ให้สร้าง type ที่ชัดเจน เช่น `AttractionSummary`, `Attraction`, `Weather`
- หลีกเลี่ยง `any`; ใช้ type, union, generic หรือ type guard แทน
- ใช้ `null` ให้สอดคล้องกับค่าที่อาจไม่มีจากฐานข้อมูล และตรวจด้วย `== null` ได้เมื่อครอบคลุมทั้ง `null` และ `undefined`

### 1.3 รูปแบบ TypeScript

- ใช้ `type` สำหรับ object shape และ props ที่ไม่ต้องสืบทอด เช่น `type Props = { ... }`
- ใช้ `interface` เฉพาะเมื่อจำเป็นต้องรองรับ declaration merging หรือรูปแบบที่เหมาะกับ interface จริง ๆ
- ระบุ return type ให้กับฟังก์ชันที่เป็น public data/API boundary หรือมี logic สำคัญ
- ใช้ type ที่แคบลงเมื่อ map/filter ข้อมูล เช่น type guard ที่ใช้กับ `links`
- ใช้ optional chaining และ nullish coalescing เพื่อจัดการข้อมูลที่อาจไม่มี เช่น `a.att_name_en && ...`, `data ?? []`

## 2. โครงสร้าง Component

### 2.1 ค่าเริ่มต้นของ Component

- ใช้ React Server Component เป็นค่าเริ่มต้น เพราะหน้าเว็บหลักอ่านข้อมูลจาก Supabase และไม่จำเป็นต้องมี browser state
- อย่าใส่ `"use client"` หากยังสามารถทำงานด้วย Server Component ได้
- ใช้ Client Component เฉพาะกรณีที่ต้องใช้ state, event handler, browser API หรือ interaction ที่จำเป็นจริง ๆ
- Component ควรทำหน้าที่เดียวและรับข้อมูลผ่าน props ที่มี type ชัดเจน
- แยก data fetching และ business logic ออกจาก UI เมื่อ logic มีขนาดใหญ่หรือถูกใช้ซ้ำ

### 2.2 การวางโครงสร้างไฟล์

- `src/app/**/page.tsx` ใช้ประกอบ route และจัด layout ของหน้านั้น
- `src/components/` ใช้ Component ที่มีโอกาสนำกลับมาใช้ซ้ำหรือมีรายละเอียด UI/logic ของตัวเอง
- `src/lib/` ใช้สำหรับการอ่านข้อมูล แปลงข้อมูล และเชื่อมต่อ service ภายนอก
- ตัวอย่างรูปแบบปัจจุบัน:
  - `WeatherCard` อยู่ใน `src/components/weather-card.tsx`
  - `getWeather` และคำอธิบาย weather code อยู่ใน `src/lib/weather.ts`
  - `AttractionPage` เรียกใช้ Component และ data helper โดยไม่สร้าง query ยาว ๆ ใน JSX

### 2.3 รูปแบบภายใน Component

- เรียงลำดับโดยทั่วไปเป็น:
  1. imports
  2. type/constant ที่ใช้เฉพาะไฟล์
  3. helper function
  4. Component หลัก
  5. Component ย่อยหรือ skeleton ที่เกี่ยวข้อง
- ใช้ early return สำหรับกรณีข้อมูลไม่มี เช่น `if (!body) return null` และ `if (!a) notFound()`
- คำนวณค่าที่ต้องใช้ก่อน `return` เช่น `address`, `links`, `hasMap`, `mapUrl`
- หลีกเลี่ยง JSX ที่ซ้อนลึกเกินจำเป็น ควรแยกเป็น Component หรือ helper เมื่ออ่านยาก
- ใช้ `key` ที่ stable จากข้อมูลจริง เช่น `a.att_id`, `day.date`, `label`
- ใช้ semantic HTML เช่น `header`, `main`, `article`, `section`, `nav`, `aside`, `dl`, `ol`, `ul`
- ลิงก์ภายในแอปใช้ `next/link`; ลิงก์ภายนอกใช้ `<a>` พร้อม `target="_blank"` และ `rel="noopener noreferrer"`
- สำหรับข้อมูลที่โหลดแบบ async ให้เตรียม loading และ fallback ที่สื่อความหมาย เช่น `WeatherCardSkeleton`

### 2.4 Error และ not-found UI

- ถ้ารายการไม่พบ ให้แสดง empty state ที่เข้าใจง่าย เช่น `ไม่พบสถานที่ที่ตรงกับเงื่อนไข`
- ถ้า resource รายตัวไม่พบ ให้ใช้ `notFound()` และหน้า `src/app/not-found.tsx`
- ข้อมูลเสริม เช่น weather ควร fail soft: ถ้าโหลดไม่ได้ให้หน้าเนื้อหาหลักยังแสดงได้
- Error ที่มาจาก data source และทำให้หน้าใช้งานไม่ได้ควร throw พร้อมข้อความที่ระบุ service และสาเหตุ เช่น `Failed to load attractions: ...`

## 3. สี ฟอนต์ spacing และ Responsive Design

### 3.1 สี

ใช้ design tokens จาก `src/app/globals.css` เป็นหลัก ไม่ hard-code สีซ้ำใน Component:

- `background` — สีพื้นหลังของหน้า
- `surface` — สีพื้นหลังของ card, form และ panel
- `foreground` — สีข้อความหลัก
- `muted` — สีข้อความรอง
- `border` — สีเส้นขอบ
- `accent` — สีหลักสำหรับลิงก์ ปุ่ม และสถานะที่เน้น

ใช้ utility ที่ผูกกับ token เหล่านี้ เช่น `bg-surface`, `text-muted`, `border-border`, `text-accent`, `bg-accent`

- อย่าใช้สีใหม่แบบสุ่มในหน้าใดหน้าหนึ่ง หากสีมีโอกาสถูกใช้ซ้ำให้เพิ่มเป็น token ก่อน
- ต้องรองรับทั้ง light และ dark mode ที่กำหนดผ่าน `prefers-color-scheme`
- ตัวอักษรบน `bg-accent` ใช้ `text-white dark:text-black` ตามรูปแบบปัจจุบัน
- สถานะ disabled หรือ unavailable ใช้ `text-muted` แทนการสร้างสีเทาใหม่

### 3.2 ฟอนต์และข้อความ

- ใช้ `Noto Sans Thai` ผ่าน `next/font/google` เป็นฟอนต์หลัก
- รักษา `font-sans` ที่ body เพื่อให้ token ของฟอนต์ทำงานทั่วทั้งแอป
- หัวข้อหลักใช้ `font-bold`; หัวข้อส่วนใช้ `font-semibold`
- ข้อความรองใช้ `text-sm text-muted` หรือ `text-xs text-muted` ตามระดับความสำคัญ
- ข้อความภาษาไทยควรใช้ line-height ที่อ่านง่าย เช่น `leading-relaxed` สำหรับรายละเอียดหลายบรรทัด
- ตัวเลขอุณหภูมิ จำนวนผลลัพธ์ ราคา และค่าที่ต้องเทียบกัน ใช้ `tabular-nums` เมื่อเหมาะสม

### 3.3 Spacing, card และ control

- ใช้ spacing scale ของ Tailwind เช่น `gap-4`, `space-y-6`, `p-4`, `p-5`, `py-6`
- ใช้ `rounded-lg` สำหรับ control และ `rounded-xl` สำหรับ card/panel หลัก
- card หลักใช้รูปแบบ `border border-border bg-surface`
- form control ควรมีความสูงและ padding สม่ำเสมอ เช่น `px-3 py-2 text-sm`
- ปุ่มหลักใช้ `bg-accent`, ตัวอักษรที่อ่านชัด และ padding แนวนอนเพียงพอ
- อย่าใช้ margin ติดลบหรือค่าพิเศษ หากยังจัด layout ด้วย `gap`, `space-*`, `p-*` ได้

### 3.4 Responsive Design

- ออกแบบจาก mobile ก่อน แล้วเพิ่ม layout ที่กว้างขึ้นด้วย breakpoint ของ Tailwind
- ใช้ `grid` และ `flex` ที่ปรับตาม breakpoint เช่น:
  - ผลลัพธ์: `sm:grid-cols-2 lg:grid-cols-3`
  - หน้า detail: `lg:grid-cols-[2fr_1fr]`
  - ฟอร์มค้นหา: mobile เป็นคอลัมน์เดียว และ desktop ใช้ grid หลายคอลัมน์
- อย่ากำหนดความกว้างตายตัวที่ทำให้ภาษาไทยล้นหรือควบคุมบนจอเล็กไม่ได้
- รายละเอียดที่ยาวต้องรองรับการขึ้นบรรทัด เช่น `whitespace-pre-line`
- ตรวจสอบทั้ง viewport มือถือและ desktop เมื่อเพิ่มหรือแก้ layout
- interactive control ต้องมี focus state ที่มองเห็นได้ เช่น `focus:ring-2 focus:ring-accent`
- animation ต้องไม่เป็นอุปสรรคกับผู้ใช้ที่เปิด reduced motion; ใช้ `motion-reduce` กับ animation ที่เหมาะสม

## 4. แนวทางเขียน Tailwind CSS

- ใช้ Tailwind utility classes ใน JSX เป็นหลัก ตามรูปแบบของโค้ดปัจจุบัน
- ใช้ `className` หลายบรรทัดเมื่อมี class จำนวนมาก เพื่อให้อ่านและแก้ไขง่าย
- เรียง class โดยประมาณจาก layout → spacing → สี/เส้นขอบ → typography → interaction เช่น:

  ```tsx
  className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
  ```

- ใช้ค่า token ที่ตั้งไว้แล้วแทน arbitrary value และสี hex ใน Component
- ใช้ responsive modifier เช่น `sm:`, `md:`, `lg:` เฉพาะจุดที่เปลี่ยน layout หรือความหนาแน่นจริง
- ใช้ state modifier เช่น `hover:`, `focus:`, `dark:`, `motion-reduce:` เพื่อให้ interaction และ accessibility ครบ
- ถ้า class pattern ซ้ำหลายครั้งและเริ่มดูแลยาก ให้พิจารณาแยกเป็น Component หรือ constant ที่มีชื่อสื่อความหมาย
- อย่าใช้ `@apply` เป็นค่าเริ่มต้น; ใช้เมื่อเป็น global pattern ที่ไม่เหมาะจะเขียนซ้ำใน JSX จริง ๆ
- CSS global ควรเก็บเฉพาะ token, base style และสิ่งที่ Tailwind utility แทนไม่ได้
- ก่อนเพิ่ม custom CSS ให้ตรวจว่ามี utility ที่เหมาะสมอยู่แล้วหรือไม่

## 5. รูปแบบภาษาไทย/อังกฤษในหน้าเว็บ

### 5.1 หลักทั่วไป

- ภาษาเริ่มต้นของเว็บคือภาษาไทย และ root document ใช้ `lang="th"`
- ข้อความใน UI, ปุ่ม, filter, empty state, loading และ error ใช้ภาษาไทยเป็นหลัก
- ชื่อแบรนด์ ชื่อสถานที่ภาษาอังกฤษ ชื่อ service และ URL คงรูปแบบต้นฉบับได้
- ไม่แปลข้อมูลจากฐานข้อมูลแบบเดาสุ่ม ให้ใช้ field ภาษาไทยและภาษาอังกฤษที่มีอยู่จริง

### 5.2 การใช้สองภาษาในรายละเอียด

- ชื่อสถานที่: แสดง `att_name_th` เป็นหลัก และ `att_name_en` เป็นข้อความรองเมื่อมีค่า
- รายละเอียด: ใช้หัวข้อ `รายละเอียด` สำหรับไทย และ `Description` สำหรับข้อมูลภาษาอังกฤษ ตามรูปแบบปัจจุบัน
- ข้อมูลเฉพาะผู้ใช้ไทยใช้ภาษาไทย เช่น `ค่าเข้าชม (คนไทย)`, `ฟรี`, `ก่อนหน้า`, `ถัดไป`
- ชื่อ social media และ platform ใช้ชื่อสากล เช่น `Facebook`, `Instagram`, `YouTube`
- ไม่สลับภาษาในประโยคเดียวโดยไม่มีเหตุผล ยกเว้นชื่อเฉพาะหรือศัพท์ที่ผู้ใช้คุ้นเคย

### 5.3 รูปแบบตัวเลขและหน่วย

- จำนวนผลลัพธ์ใช้ `toLocaleString("th-TH")`
- อุณหภูมิใช้ `°C`; ความเร็วลมใช้ `กม./ชม.`
- ราคาแสดงเป็น `บาท` และใช้ `ฟรี` เมื่อค่าเป็นศูนย์
- วันที่และเวลาใช้ locale `th-TH` และ timezone `Asia/Bangkok`
- ข้อความที่มาจาก field HTML ต้องแปลงด้วย `htmlToText` ก่อนแสดงใน plain text UI

## 6. กฎการทำงานกับ Supabase และ Error Handling

### 6.1 การเชื่อมต่อและ Environment

- ใช้ `getSupabase()` จาก `src/lib/supabase.ts` เป็นจุดกลางในการสร้าง client
- อย่าสร้าง Supabase client ใหม่ในแต่ละ Component หรือในแต่ละ query
- รองรับ environment ตามลำดับที่มีอยู่ในโค้ด:
  1. `SUPABASE_URL`
  2. `NEXT_PUBLIC_SUPABASE_URL`
  3. `SUPABASE_PUBLISHABLE_KEY`
  4. `SUPABASE_ANON_KEY`
  5. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  6. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ห้าม commit `.env.local` หรือค่า key ใด ๆ ลง Git
- ถ้า environment ไม่ครบ ให้ throw error ที่บอกชื่อ variable และวิธีตั้งค่าอย่างชัดเจน
- โปรเจกต์นี้ใช้ข้อมูล public แบบ read-only จึงตั้ง `persistSession: false` และ `autoRefreshToken: false`

### 6.2 ตำแหน่งของ Query

- Query Supabase ต้องอยู่ใน `src/lib/` ไม่ควรเขียนตรงใน JSX
- ใช้ type ของผลลัพธ์กับ `.returns<T>()` เพื่อป้องกันการใช้ field ผิด
- เลือกเฉพาะ column ที่จำเป็นสำหรับ list เช่น `LIST_COLUMNS` แทนการใช้ `select("*")`
- ใช้ `select("*")` เฉพาะหน้า detail ที่ต้องการข้อมูลเต็มจริง ๆ
- ใช้ `Promise.all` เมื่อ query หลายชุดไม่ขึ้นต่อกัน เช่น รายการสถานที่และ filter options
- ใช้ `cache()` เมื่อ query เดียวกันถูกเรียกซ้ำระหว่าง `generateMetadata` และ page
- ใช้ pagination จาก database ด้วย `.range()` ไม่ดึงข้อมูลทั้งหมดมาจัดหน้าใน memory
- กำหนด order ที่แน่นอน เช่น `.order("att_name_th")` เพื่อให้ผลลัพธ์คงที่ระหว่างหน้า

### 6.3 Filter และความปลอดภัย

- ตรวจและ normalize query parameter ก่อนส่งเข้า query เช่น `toInt`, `first`, `trim`
- Query search ต้อง sanitize อักขระที่เป็น syntax ของ PostgREST ก่อนนำไปใช้ใน `.or(...)`
- filter ที่มาจาก URL ต้องถือว่าเป็นข้อมูลที่ผู้ใช้ควบคุม ห้ามเชื่อว่าเป็นตัวเลขหรือ id ที่ถูกต้องจนกว่าจะ validate
- ใช้ equality filter กับ field ที่กำหนด เช่น category, type และ province
- ห้ามเปิด write access ให้ public role หากฟีเจอร์นั้นยังไม่ได้ออกแบบเรื่อง authentication และ authorization
- Supabase migration ต้องกำหนด RLS/policy และ `grant` ให้ครบ เพราะ policy อย่างเดียวอาจไม่เพียงพอ
- View ที่เปิดให้ API อ่านควรใช้ `security_invoker = on` เพื่อให้เคารพ RLS ของตารางต้นทาง

### 6.4 Error Handling

- ตรวจ `error` จากทุก Supabase query และ throw error ที่มี context เช่น `Failed to load attractions: ...`
- อย่ากลืน error ของ data หลัก เพราะจะทำให้ผู้ใช้เห็นหน้าว่างโดยไม่รู้สาเหตุ
- ข้อมูลเสริมที่ไม่ critical เช่น weather ให้ใช้ fail-soft และคืน `null` เมื่อ fetch ไม่สำเร็จ
- `getWeather` ต้องตรวจทั้ง HTTP status และโครงสร้าง response ก่อน map ข้อมูล
- ไม่แสดงรายละเอียด error ภายในหรือ secret ให้ผู้ใช้ปลายทางโดยตรงใน production
- สำหรับ error ที่ควรแก้ด้วยหน้า UI ควรเพิ่ม `error.tsx` ใน route ที่เกี่ยวข้องเมื่อมีการทำระบบ production ให้สมบูรณ์

### 6.5 External URL และข้อมูลจากฐานข้อมูล

- URL จากฐานข้อมูลต้องผ่าน `toExternalUrl()` ก่อนสร้าง external link
- รองรับเฉพาะ URL ที่เป็น `http://`, `https://` หรือ domain ที่ normalize เป็น `https://`
- external link ที่เปิด tab ใหม่ต้องมี `rel="noopener noreferrer"`
- ข้อมูล rich text จากฐานข้อมูลห้ามนำไป render เป็น raw HTML โดยตรง เว้นแต่มีการ sanitize ที่เชื่อถือได้
- ปัจจุบันให้ใช้ `htmlToText()` สำหรับแสดงเป็น plain text

## 7. Checklist ก่อนส่งงาน

- ชื่อไฟล์และชื่อ Component เป็นไปตาม convention
- ไม่มี `any` หรือ type ที่กว้างเกินความจำเป็น
- Component ใหม่ใช้ Server Component ได้หรือไม่
- UI มี loading, empty และ error state ที่เหมาะสม
- สีใช้ design token และรองรับ dark mode
- layout ดูได้ทั้ง mobile และ desktop
- ข้อความ UI เป็นภาษาไทยสม่ำเสมอ และ field ภาษาอังกฤษแสดงเป็นข้อมูลรองเมื่อเหมาะสม
- Query อยู่ใน `src/lib/`, เลือก column เท่าที่จำเป็น และตรวจ error แล้ว
- ไม่มี secret หรือ `.env.local` อยู่ใน commit
- รันคำสั่งต่อไปนี้ก่อน merge เมื่อสภาพแวดล้อมพร้อม:

  ```bash
  npm run lint
  npm run build
  ```

