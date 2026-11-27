// Deliberately incomplete variant for the isolated Red demonstration.
export function normalizeRussianPhone(value) {
  return '+7' + value.replace(/\D/g, '');
}
