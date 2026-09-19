import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { FacebookIcon } from "@/components/facebook-icon";
import { GoogleIcon } from "@/components/google-icon";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StickerCard } from "@/components/ui/sticker-card";
import { MOCK_EMAIL, MOCK_PASSWORD } from "@/lib/mock-auth";
import { getCurrentUser } from "@/lib/supabase-server";
import { signIn, signInAsDemo, signInWithFacebook, signInWithGoogle, signUp } from "./actions";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = first(params.next) ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  if (await getCurrentUser()) redirect(next);

  const error = first(params.error);
  const message = first(params.message);
  const field =
    "min-h-11 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-3 focus:border-accent focus:outline-none";
  const social = buttonClass("ghost", "w-full justify-center gap-3 border-foreground");

  return (
    <div className="mx-auto max-w-md space-y-5 py-4">
      <div className="text-center">
        <Image src="/logo.webp" alt="ไทยไหนดี" width={180} height={180} priority className="mx-auto" />
        <h1 className="mt-2 text-2xl font-extrabold">
          เก็บ<span className="hl">แผนเที่ยว</span>ของคุณไว้ กลับมาใช้ได้ทุกเมื่อ
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          สมัครครั้งเดียว แผนทุกทริปจะถูกบันทึกไว้ พร้อมโปรไฟล์ที่ช่วยให้ระบบแนะนำที่เที่ยวได้ตรงขึ้น
        </p>
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {message && <Callout tone="success">{message}</Callout>}

      <StickerCard tape className="space-y-3 p-5">
        {process.env.NODE_ENV === "development" && (
          <div className="space-y-2 rounded-[10px] border border-border bg-surface-2 p-3">
            <p className="text-xs font-bold text-subtle">บัญชีทดลองสำหรับ local</p>
            <form action={signInAsDemo} className="space-y-2">
              <input type="hidden" name="next" value={next} />
              <input
                name="email"
                type="email"
                defaultValue={MOCK_EMAIL}
                className={field}
                aria-label="อีเมลบัญชีทดลอง"
              />
              <input
                name="password"
                type="password"
                defaultValue={MOCK_PASSWORD}
                className={field}
                aria-label="รหัสผ่านบัญชีทดลอง"
              />
              <button className={buttonClass("cta", "w-full justify-center")}>เข้าสู่ระบบบัญชีทดลอง</button>
            </form>
            <p className="text-center text-xs text-subtle">อีเมล: {MOCK_EMAIL} · รหัสผ่าน: {MOCK_PASSWORD}</p>
          </div>
        )}
        <p className="text-xs font-bold text-subtle">เลือกวิธีเข้าสู่ระบบ</p>
        {/* <form action={signInWithFacebook}>
          <input type="hidden" name="next" value={next} />
          <button className={social}>
            <FacebookIcon />
            ดำเนินการด้วย Facebook
          </button>
        </form> */}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button className={`${social} cursor-pointer hover:bg-surface-2 hover:shadow-hard-sm focus-visible:bg-surface-2 active:shadow-none`}>
            <GoogleIcon />
            ดำเนินการด้วย Google
          </button>
        </form>

        <div className="flex items-center gap-3 py-1 text-xs text-subtle" role="separator">
          <span className="h-px flex-1 bg-border" />
          หรือใช้อีเมล
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-3.5">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={first(params.email)}
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className={field}
            />
            <p className="text-xs text-subtle">อย่างน้อย 6 ตัวอักษร</p>
          </div>
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            <button formAction={signIn} className={buttonClass("cta", "w-full")}>
              เข้าสู่ระบบ
            </button>
            <button formAction={signUp} className={buttonClass("ink", "w-full")}>
              สมัครสมาชิกใหม่
            </button>
          </div>
        </form>
      </StickerCard>
    </div>
  );
}
