export function normalizeRussianPhone(value) {
  if (typeof value !== "string" || /[^\d+()\s-]/.test(value))
    throw new Error("Введите российский номер: +7 (XXX)-XXX-XX-XX");
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
  if (!/^\d{10}$/.test(digits))
    throw new Error("Введите 10 цифр номера после +7");
  return "+7" + digits;
}
export function displayRussianPhone(value) {
  try {
    const d = normalizeRussianPhone(value).slice(2);
    return `+7 (${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
  } catch {
    return "";
  }
}
