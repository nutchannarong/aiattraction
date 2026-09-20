"use client";

import { signOut } from "@/app/login/actions";
import { buttonClass } from "@/components/ui/button";
import { clearAllLocalTrips } from "@/lib/local-trips";

export function SignOutButton() {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        clearAllLocalTrips();
      }}
    >
      <button type="submit" className={buttonClass("ghost", "min-h-10 px-3.5 text-[13px]")}>
        ออกจากระบบ
      </button>
    </form>
  );
}
