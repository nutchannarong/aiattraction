import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = first(params.next) ?? "/";
  if (await getCurrentUser()) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");

  const error = first(params.error);
  const message = first(params.message);
  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted">ใช้อีเมลเดิมเพื่อเข้าสู่ระบบ หรือสมัครสมาชิกใหม่</p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <form className="space-y-4 rounded-xl border border-border bg-surface p-5">
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
          <p className="text-xs text-muted">อย่างน้อย 6 ตัวอักษร</p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button
            formAction={signIn}
            className="min-h-11 rounded-lg bg-accent px-4 font-medium text-white dark:text-black"
          >
            เข้าสู่ระบบ
          </button>
          <button
            formAction={signUp}
            className="min-h-11 rounded-lg border border-border px-4 font-medium hover:border-accent"
          >
            สมัครสมาชิก
          </button>
        </div>
      </form>
    </div>
  );
}
