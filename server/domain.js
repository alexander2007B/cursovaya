export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(
    new Date(),
  );
export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, "Укажите корректные даты аренды");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== value)
    throw new AppError(400, "Такой даты не существует");
  return date;
}
export function calculateQuote(car, from, to, extras = {}, now = today()) {
  const start = parseDate(from),
    end = parseDate(to);
  const days = (+end - +start) / 86400000;
  if (from < now || days < 1 || days > 30)
    throw new AppError(
      400,
      "Аренда возможна от 1 до 30 суток, начиная с сегодняшнего дня",
    );
  const base = Math.round(car.dailyRate * days * (days >= 7 ? 0.9 : 1));
  const insurance = extras.insurance ? days * 600 : 0;
  const childSeat = extras.childSeat ? days * 300 : 0;
  return {
    days,
    dailyRate: car.dailyRate,
    base,
    insurance,
    childSeat,
    total: base + insurance + childSeat,
    deposit: car.deposit,
  };
}
export function validateTransition(from, to, role) {
  const transitions = {
    new: ["confirmed", "cancelled"],
    confirmed: ["active", "cancelled"],
    active: ["completed"],
    completed: [],
    cancelled: [],
  };
  if (
    !transitions[from]?.includes(to) ||
    (role === "client" && to !== "cancelled")
  )
    throw new AppError(409, "Этот переход статуса недоступен");
}
