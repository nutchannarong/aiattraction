export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function passwordFeedback(password: string) {
  const length = Array.from(password).length;
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const digit = /[0-9]/.test(password);
  const symbol = /[^\p{L}\p{N}\s]/u.test(password);
  const predictable = /^(.)\1+$/u.test(password) || /^(?:1234567890?|0123456789|password|qwerty|abcdef)+[!@#$\d]*$/i.test(password);
  const variety = [lower, upper, digit, symbol].filter(Boolean).length;
  const level = !password ? 0 : length < PASSWORD_MIN || predictable ? 1 : length >= 20 || variety >= 3 ? 3 : 2;
  return { length, lower, upper, digit, symbol, level, predictable };
}

export function signupPasswordError(password: string): string | null {
  const { length, predictable } = passwordFeedback(password);
  if (length < PASSWORD_MIN) return `รหัสผ่านสำหรับสมัครสมาชิกต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`;
  if (length > PASSWORD_MAX) return `รหัสผ่านต้องยาวไม่เกิน ${PASSWORD_MAX} ตัวอักษร`;
  if (predictable) return "รหัสผ่านนี้คาดเดาง่าย กรุณาใช้คำหลายคำที่ไม่เกี่ยวข้องกันหรือรหัสผ่านที่สุ่มขึ้น";
  return null;
}
