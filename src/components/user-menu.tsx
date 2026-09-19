import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { buttonClass } from "@/components/ui/button";
import { getMyProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/supabase-server";

export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className={buttonClass("ghost", "min-h-10 px-3.5 text-[13px]")}>
        เข้าสู่ระบบ
      </Link>
    );
  }

  const profile = await getMyProfile();
  const name = profile?.full_name || user.email;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/profile"
        className="flex min-h-10 max-w-48 items-center gap-1.5 rounded-full px-2 hover:bg-surface-2"
        title="โปรไฟล์ของฉัน"
      >
        <CircleUserRound className="size-5 flex-none" aria-hidden="true" />
        <span className="hidden truncate sm:inline">{name}</span>
        <span className="sr-only sm:hidden">โปรไฟล์ของฉัน</span>
      </Link>
      <form action={signOut}>
        <button className={buttonClass("ghost", "min-h-10 px-3.5 text-[13px]")}>ออกจากระบบ</button>
      </form>
    </div>
  );
}
