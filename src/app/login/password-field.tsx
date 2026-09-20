"use client";

import { useState } from "react";
import { PASSWORD_MIN, PASSWORD_MAX, passwordFeedback } from "@/lib/password-policy";

export function PasswordField({ className }: { className: string }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const feedback = passwordFeedback(password);
  const labels = ["ยังไม่ได้กรอก", "คาดเดาง่าย", "พอใช้", "ดี"];
  return <div className="space-y-2">
    <label htmlFor="password" className="text-sm font-medium">รหัสผ่าน</label>
    <div className="relative">
      <input id="password" name="password" type={visible ? "text" : "password"}
        required autoComplete="current-password" className={`${className} pr-20`}
        value={password} onChange={event => setPassword(event.target.value)}
        aria-describedby="password-guidance password-strength" />
      <button type="button" className="absolute inset-y-0 right-0 px-3 text-xs font-semibold"
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={visible}
        onClick={() => setVisible(value => !value)}>{visible ? "ซ่อน" : "แสดง"}</button>
    </div>
    <div id="password-guidance" className="space-y-2 rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted">
      <p className="font-semibold">สมัครสมาชิกใหม่: ใช้รหัสผ่าน {PASSWORD_MIN}–{PASSWORD_MAX} ตัวอักษร</p>
      <p>แนะนำใช้คำหลายคำที่ไม่เกี่ยวข้องกัน หลีกเลี่ยงชื่อ วันเกิด และรหัสที่ใช้กับเว็บอื่น</p>
      <p>ตัวเล็ก a–z · ตัวใหญ่ A–Z · ตัวเลข 0–9 · สัญลักษณ์ เช่น !@# ใช้ผสมกันได้ แต่ไม่บังคับครบทุกชนิด</p>
      <ul className="grid grid-cols-2 gap-1" aria-label="ส่วนประกอบรหัสผ่าน">
        {[["ตัวเล็ก a–z", feedback.lower], ["ตัวใหญ่ A–Z", feedback.upper], ["ตัวเลข 0–9", feedback.digit], ["สัญลักษณ์", feedback.symbol]].map(([label, met]) =>
          <li key={String(label)}>{met ? "✓ มี" : "– ยังไม่มี"} {label}</li>)}
      </ul>
      <p>หากมีบัญชีอยู่แล้ว ให้ใช้รหัสผ่านเดิมเพื่อเข้าสู่ระบบ</p>
    </div>
    <div id="password-strength" role="status" aria-live="polite" className="space-y-1 text-xs text-muted">
      <p>ความแข็งแรงโดยประมาณ: {labels[feedback.level]} · {feedback.length} ตัวอักษร</p>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map(step => <span key={step} className={`h-1.5 flex-1 rounded-full ${feedback.level >= step ? feedback.level === 1 ? "bg-red-500" : feedback.level === 2 ? "bg-amber-500" : "bg-emerald-600" : "bg-border"}`} />)}
      </div>
      <p>เป็นการประเมินเบื้องต้น ไม่ใช่การตรวจว่ารหัสผ่านเคยรั่วไหลหรือไม่</p>
    </div>
  </div>;
}
