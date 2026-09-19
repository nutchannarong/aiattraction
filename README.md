# aiattraction

Ai Attraction — ค้นหาแหล่งท่องเที่ยวทั่วประเทศไทย (Next.js 16 + Supabase, deploy บน Vercel)

## เริ่มต้นใช้งาน (local)

```bash
npm install
cp .env.example .env.local   # ใส่ค่า Supabase URL และ publishable key
npm run dev                  # http://localhost:3000
```

## Environment variables

| ชื่อ | ที่มา |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_...`) |

## ฐานข้อมูล

ใช้ตาราง `public.attraction` ใน Supabase project `ai-system`
SQL ที่แอปต้องใช้ (สิทธิ์อ่านแบบ public และ view สำหรับตัวกรอง) อยู่ใน `supabase/migrations/`

## Deploy ขึ้น Vercel

1. Push repo นี้ขึ้น GitHub
2. ไปที่ https://vercel.com/new → Import `aiattraction` (Vercel ตรวจเจอ Next.js ให้อัตโนมัติ)
3. ใส่ Environment Variables ทั้งสองตัวด้านบน (ถ้าเชื่อม Supabase Integration ใน Vercel ไว้ จะมีให้อัตโนมัติ) → Deploy

หลังจากนั้นทุกครั้งที่ push ไป `main` Vercel จะ deploy ให้อัตโนมัติ
