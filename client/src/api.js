let csrfToken = "";
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response
    .json()
    .catch(() => ({ message: "Сервер временно недоступен" }));
  if (!response.ok) {
    const err = new Error(data.message);
    err.fields = data.fields;
    err.status = response.status;
    throw err;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
export const money = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
export const date = (s) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const day = (offset = 0) => {
  const d = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(
      new Date(),
    ) + "T00:00:00Z",
  );
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
export const categories = {
  economy: "Эконом",
  comfort: "Комфорт",
  business: "Бизнес",
  suv: "Кроссоверы",
};
export const statuses = {
  new: "Новая",
  confirmed: "Подтверждена",
  active: "В аренде",
  completed: "Завершена",
  cancelled: "Отменена",
  available: "Доступен",
  rented: "В аренде",
  maintenance: "На обслуживании",
  broken: "Неисправен",
};
export const roles = {
  client: "Клиент",
  manager: "Менеджер",
  admin: "Администратор",
};
