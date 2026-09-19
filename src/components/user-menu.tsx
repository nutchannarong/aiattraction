import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/supabase-server";

export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent"
      >
        เข้าสู่ระบบ
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className="hidden max-w-48 truncate text-muted sm:inline"
        title={user.email ?? undefined}
      >
        {user.email}
      </span>
      <form action={signOut}>
        <button className="rounded-lg border border-border px-3 py-1.5 hover:border-accent">
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
