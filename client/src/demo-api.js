// Local UI sandbox only. The server remains authoritative in normal mode.
import { cars as seed } from "./demo-cars";
import {
  calculateQuote,
  validateTransition,
  today,
} from "../../server/domain.js";
const KEY = "avtobaza-preview-v1",
  SESSION = "avtobaza-preview-user";
const uid = () => crypto.randomUUID().replaceAll("-", "").slice(0, 24);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const hash = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const publicUser = (u) => {
  if (!u) return null;
  const { passwordHash, ...safe } = u;
  return safe;
};
function initial() {
  return {
    users: [
      ["admin", "Администратор"],
      ["manager", "Анна Миронова"],
      ["client", "Александр Баев"],
    ].map(([role, name]) => ({
      id: uid(),
      email: `${role}@avtobaza.test`,
      name,
      role,
      phone: "+7 900 123-45-67",
      demo: true,
    })),
    cars: seed.map(
      ([
        brand,
        model,
        year,
        plate,
        category,
        dailyRate,
        deposit,
        mileage,
        seats,
        transmission,
        fuel,
        image,
        description,
        status,
      ]) => ({
        _id: uid(),
        brand,
        model,
        year,
        plate,
        category,
        dailyRate,
        deposit,
        mileage,
        seats,
        transmission,
        fuel,
        image: `/images/${image}.svg`,
        description,
        status,
        archived: false,
      }),
    ),
    rentals: [],
    records: [],
    events: [],
  };
}
export function resetDemo() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(SESSION);
  location.assign("/");
}
export async function demoApi(path, { method = "GET", body = {} } = {}) {
  const db = JSON.parse(localStorage.getItem(KEY) || "null") || initial();
  localStorage.setItem(KEY, JSON.stringify(db));
  const url = new URL(path, "http://demo"),
    p = url.pathname,
    q = url.searchParams;
  let user = db.users.find((u) => u.id === sessionStorage.getItem(SESSION));
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const requireUser = () => user || fail("Войдите в аккаунт", 401);
  const staff = () => {
    requireUser();
    if (user.role === "client") fail("Доступ только для сотрудников", 403);
  };
  const admin = () => {
    staff();
    if (user.role !== "admin") fail("Доступ только для администратора", 403);
  };
  const carBy = (id) =>
    db.cars.find((c) => c._id === id) || fail("Автомобиль не найден", 404);
  const busy = (id, from, to) =>
    db.rentals.some(
      (r) =>
        r.car === id &&
        ["new", "confirmed", "active"].includes(r.status) &&
        r.from < to &&
        r.to > from,
    );
  const rentalView = (r) => ({
    ...r,
    user: publicUser(db.users.find((u) => u.id === r.user)),
    car: db.cars.find((c) => c._id === r.car),
  });
  const recordView = (r) => ({
    ...r,
    car: carBy(r.car),
    author: publicUser(db.users.find((u) => u.id === r.author)),
  });
  const event = (action, details) =>
    db.events.unshift({
      _id: uid(),
      action,
      details,
      actor: publicUser(user),
      createdAt: new Date().toISOString(),
    });
  if (p === "/auth/session") return { user: publicUser(user) };
  if (p === "/auth/logout") {
    sessionStorage.removeItem(SESSION);
    return { ok: true };
  }
  if (p === "/auth/register" || p === "/auth/login") {
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (p.endsWith("register")) {
      if (db.users.some((u) => u.email === email))
        fail("Email уже используется", 409);
      if (
        !email.includes("@") ||
        !body.name?.trim() ||
        !body.phone ||
        body.password?.length < 8
      )
        fail("Проверьте заполнение полей");
      user = {
        id: uid(),
        name: body.name.trim(),
        phone: body.phone,
        email,
        role: "client",
        passwordHash: await hash(body.password),
      };
      db.users.push(user);
      save();
    } else {
      user = db.users.find((u) => u.email === email);
      if (
        !user ||
        (user.demo
          ? body.password !== "Avtobaza2026!"
          : (await hash(body.password)) !== user.passwordHash)
      )
        fail("Неверный email или пароль", 401);
    }
    sessionStorage.setItem(SESSION, user.id);
    return { user: publicUser(user) };
  }
  if (p === "/profile") {
    requireUser();
    if (!body.name?.trim() || body.phone.replace(/\D/g, "").length < 10)
      fail("Проверьте имя и телефон");
    Object.assign(user, { name: body.name, phone: body.phone });
    save();
    return { user: publicUser(user) };
  }
  if (p === "/cars") {
    if (q.get("from") || q.get("to"))
      calculateQuote(
        { dailyRate: 1, deposit: 0 },
        q.get("from") || "",
        q.get("to") || "",
      );
    let cars = db.cars.filter(
      (c) =>
        !c.archived &&
        (!q.get("category") ||
          q.get("category") === "all" ||
          c.category === q.get("category")) &&
        `${c.brand} ${c.model}`
          .toLowerCase()
          .includes((q.get("search") || "").toLowerCase()) &&
        (!q.get("from") ||
          (c.status === "available" &&
            !busy(c._id, q.get("from"), q.get("to")))),
    );
    cars.sort((a, b) =>
      q.get("sort") === "year"
        ? b.year - a.year
        : q.get("sort") === "price-desc"
          ? b.dailyRate - a.dailyRate
          : a.dailyRate - b.dailyRate,
    );
    return {
      cars: cars.map((c) => ({
        ...c,
        displayStatus: db.rentals.some(
          (r) => r.car === c._id && r.status === "active",
        )
          ? "rented"
          : c.status,
      })),
    };
  }
  if (p.startsWith("/cars/")) {
    const car = carBy(p.split("/")[2]);
    return {
      car,
      reservations: db.rentals
        .filter(
          (r) =>
            r.car === car._id &&
            ["new", "confirmed", "active"].includes(r.status),
        )
        .map(({ from, to }) => ({ from, to })),
    };
  }
  if (p === "/quote" || (p === "/rentals" && method === "POST")) {
    const car = carBy(body.carId),
      quote = calculateQuote(car, body.from, body.to, body.extras),
      available =
        !car.archived &&
        car.status === "available" &&
        !busy(car._id, body.from, body.to);
    if (p === "/quote") return { quote, available };
    requireUser();
    if (!available) fail("Автомобиль недоступен на эти даты", 409);
    const rental = {
      _id: uid(),
      number: "DEMO-" + uid().slice(0, 6).toUpperCase(),
      user: user.id,
      car: car._id,
      carName: `${car.brand} ${car.model}`,
      from: body.from,
      to: body.to,
      extras: body.extras,
      comment: body.comment || "",
      quote,
      status: "new",
      createdAt: new Date().toISOString(),
      history: [{ status: "new", at: new Date().toISOString(), by: user.id }],
    };
    db.rentals.unshift(rental);
    event("Новая заявка", rental.number);
    save();
    return { rental };
  }
  if (p === "/rentals") {
    requireUser();
    return {
      rentals: db.rentals.filter((r) => r.user === user.id).map(rentalView),
    };
  }
  if (/^\/rentals\/[^/]+\/status$/.test(p)) {
    requireUser();
    const r = db.rentals.find((r) => r._id === p.split("/")[2]);
    if (!r || (user.role === "client" && r.user !== user.id))
      fail("Аренда не найдена", 404);
    validateTransition(r.status, body.status, user.role);
    const c = carBy(r.car);
    if (
      body.status === "active" &&
      (r.from > today() ||
        r.to <= today() ||
        c.status !== "available" ||
        db.rentals.some((x) => x.car === c._id && x.status === "active"))
    )
      fail("Проверьте период аренды и доступность автомобиля", 409);
    if (body.status === "completed") {
      if (
        !Number.isFinite(body.returnMileage) ||
        body.returnMileage < c.mileage
      )
        fail("Пробег не может уменьшаться");
      c.mileage = body.returnMileage;
    }
    r.status = body.status;
    r.history.push({
      status: r.status,
      at: new Date().toISOString(),
      by: user.id,
    });
    event("Статус аренды", `${r.number} → ${r.status}`);
    save();
    return { rental: rentalView(r) };
  }
  if (p.startsWith("/admin")) staff();
  if (p === "/admin/overview")
    return {
      cars: db.cars.filter((c) => !c.archived),
      rentals: db.rentals.map(rentalView),
      events: db.events.slice(0, 50),
      stats: {
        cars: db.cars.filter((c) => !c.archived).length,
        active: db.rentals.filter((r) => r.status === "active").length,
        pending: db.rentals.filter((r) => r.status === "new").length,
        revenue: db.rentals
          .filter((r) => r.status === "completed")
          .reduce((n, r) => n + r.quote.total, 0),
        clients: db.users.filter((u) => u.role === "client").length,
      },
    };
  if (p.startsWith("/admin/cars")) {
    if (method === "POST") {
      admin();
      if (db.cars.some((c) => c.plate === body.plate))
        fail("Госномер уже используется");
      const car = { ...body, _id: uid(), archived: false };
      db.cars.push(car);
      event("Добавлен автомобиль", `${car.brand} ${car.model}`);
      save();
      return { car };
    }
    const car = carBy(p.split("/")[3]);
    if (method === "DELETE" || (body.status && body.status !== "available")) {
      if (
        db.rentals.some(
          (r) =>
            r.car === car._id &&
            ["new", "confirmed", "active"].includes(r.status),
        )
      )
        fail("Сначала закройте незавершённые аренды", 409);
    }
    if (method === "DELETE") {
      admin();
      car.archived = true;
    } else {
      if (
        user.role !== "admin" &&
        Object.keys(body).some((k) => k !== "status")
      )
        fail("Только администратор может менять характеристики", 403);
      if (body.mileage < car.mileage) fail("Пробег нельзя уменьшать");
      Object.assign(car, body);
    }
    event("Изменён автомобиль", `${car.brand} ${car.model}`);
    save();
    return { car };
  }
  if (p === "/admin/maintenance") {
    if (method === "GET") return { records: db.records.map(recordView) };
    const car = carBy(body.carId);
    if (body.wear < 0 || body.wear > 100 || body.mileage < car.mileage)
      fail("Проверьте износ и пробег");
    car.mileage = body.mileage;
    const record = {
      ...body,
      _id: uid(),
      car: car._id,
      author: user.id,
      createdAt: new Date().toISOString(),
    };
    db.records.unshift(record);
    event("Технический осмотр", `${car.brand} ${car.model} · ${body.node}`);
    save();
    return { record: recordView(record) };
  }
  if (p === "/admin/users") {
    admin();
    return { users: db.users.map(publicUser) };
  }
  if (p.startsWith("/admin/users/")) {
    admin();
    const u = db.users.find((u) => u.id === p.split("/")[3]);
    if (!u || u.id === user.id) fail("Нельзя изменить собственную роль");
    u.role = body.role;
    save();
    return { user: publicUser(u) };
  }
  fail("Действие недоступно в деморежиме", 404);
}
export async function exportDemo() {
  const { rentals } = await demoApi("/admin/overview");
  const rows = [
    ["Номер", "Автомобиль", "С", "По", "Статус", "Стоимость"],
    ...rentals.map((r) => [
      r.number,
      r.carName,
      r.from,
      r.to,
      r.status,
      r.quote.total,
    ]),
  ];
  const csv =
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (x) =>
              '"' +
              String(x)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(";"),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "demo-rentals.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
