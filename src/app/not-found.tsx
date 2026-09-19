import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center space-y-4">
      <p className="text-muted">ไม่พบหน้าที่ต้องการ</p>
      <Link href="/" className="text-accent">
        กลับไปหน้าค้นหา
      </Link>
    </div>
  );
}
