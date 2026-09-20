import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { GoogleIcon } from "@/components/google-icon";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StickerCard } from "@/components/ui/sticker-card";
import { MOCK_EMAIL, MOCK_PASSWORD } from "@/lib/mock-auth";
import { getCurrentUser } from "@/lib/supabase-server";
import { signIn, signInAsDemo, signInWithGoogle, signUp } from "./actions";
import { PasswordField } from "./password-field";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(first(params.next));
  const isAdminLogin = next === "/admin";
  // A regular app session is not an admin session. Keeping the admin login
  // visible also prevents a redirect loop when a demo user is already signed in.
  if (!isAdminLogin && await getCurrentUser()) redirect(next);

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
          {isAdminLogin ? <>เข้าสู่ระบบ<span className="hl">ผู้ดูแล</span></> : <>เก็บ<span className="hl">แผนเที่ยว</span>ของคุณไว้ กลับมาใช้ได้ทุกเมื่อ</>}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isAdminLogin ? "เข้าสู่ Admin Dashboard เพื่อดูภาพรวมผู้ใช้และทริป" : "สมัครครั้งเดียว แผนทุกทริปจะถูกบันทึกไว้ พร้อมโปรไฟล์ที่ช่วยให้ระบบแนะนำที่เที่ยวได้ตรงขึ้น"}
        </p>
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {message && <Callout tone="success">{message}</Callout>}

      <StickerCard tape className="space-y-3 p-5">
        {process.env.NODE_ENV === "development" && !isAdminLogin && (
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
        {!isAdminLogin && <p className="text-xs font-bold text-subtle">เลือกวิธีเข้าสู่ระบบ</p>}
        {!isAdminLogin && <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button className={`${social} cursor-pointer hover:bg-surface-2 hover:shadow-hard-sm focus-visible:bg-surface-2 active:shadow-none`}>
            <GoogleIcon />
            ดำเนินการด้วย Google
          </button>
        </form>}

        {!isAdminLogin && <div className="flex items-center gap-3 py-1 text-xs text-subtle" role="separator">
          <span className="h-px flex-1 bg-border" />
          หรือใช้อีเมล
          <span className="h-px flex-1 bg-border" />
        </div>}

        <form className="space-y-3.5">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              {isAdminLogin ? "ชื่อผู้ใช้หรืออีเมล" : "อีเมล"}
            </label>
            <input
              id="email"
              name="email"
              type={isAdminLogin ? "text" : "email"}
              required
              autoComplete="email"
              defaultValue={first(params.email)}
              placeholder={isAdminLogin ? "admin@thainhaidee.local" : undefined}
              className={field}
            />
          </div>
          <PasswordField className={field} />
          <div className={`grid gap-2 pt-1 ${isAdminLogin ? "" : "sm:grid-cols-2"}`}>
            <button formAction={signIn} className={buttonClass("cta", "w-full")}>
              เข้าสู่ระบบ
            </button>
            {!isAdminLogin && <button formAction={signUp} className={buttonClass("ink", "w-full")}>
              สมัครสมาชิกใหม่
            </button>}
          </div>
        </form>
      </StickerCard>
    </div>
  );
}
