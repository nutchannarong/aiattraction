"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let session = crypto.randomUUID();
    let lastPing = 0;
    let sessionDay = "";
    let stopped = false;
    const ping = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
      if (day !== sessionDay || Date.now() - lastPing >= 30 * 60_000) session = crypto.randomUUID();
      try {
        const saved = JSON.parse(sessionStorage.getItem("thainhaidee:activity") ?? "null");
        if (saved?.day === day && Date.now() - saved.at < 30 * 60_000 && typeof saved.id === "string") session = saved.id;
        sessionStorage.setItem("thainhaidee:activity", JSON.stringify({ id: session, day, at: Date.now() }));
      } catch { /* Storage is optional. */ }
      sessionDay = day;
      lastPing = Date.now();
      try {
        const response = await fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session }) });
        if (response.status === 401 || response.status === 503) stopped = true;
      } catch { /* Best effort. */ }
    };
    void ping();
    const timer = setInterval(() => void ping(), 30_000);
    return () => { stopped = true; clearInterval(timer); };
  }, [pathname]);
  return null;
}
