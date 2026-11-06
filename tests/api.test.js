import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { User, Car, Rental, Event } from "../server/models.js";
import { today } from "../server/domain.js";
let app, client, other, manager, admin, car, rentalId;
const uri = `mongodb://127.0.0.1:27017/avtobaza_test_${process.pid}?replicaSet=rs0&directConnection=true`;
const tomorrow = () => {
  let d = new Date(today() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
};
const carData = {
  brand: "Test",
  model: "Sedan",
  year: 2024,
  plate: "ТЕСТ001",
  category: "comfort",
  dailyRate: 4000,
  deposit: 20000,
  mileage: 1000,
  seats: 5,
  transmission: "Автомат",
  fuel: "Бензин",
  image: "/images/sedan.svg",
  description: "Автомобиль для интеграционной проверки",
  status: "available",
};
async function actor(email, role) {
  await User.create({
    name: "Тестовый пользователь",
    email,
    phone: "+79001234567",
    ageConfirmed: true,
    licenseConfirmed: true,
    drivingExperience: 3,
    role,
    passwordHash: await bcrypt.hash("Testpass2026!", 4),
  });
  const agent = request.agent(app);
  let r = await agent.get("/api/auth/session");
  r = await agent
    .post("/api/auth/login")
    .set("X-CSRF-Token", r.body.csrfToken)
    .send({ email, password: "Testpass2026!" });
  assert.equal(r.status, 200);
  return { agent, token: r.body.csrfToken };
}
const mutation = (actor, method, url, data) =>
  actor.agent[method](url).set("X-CSRF-Token", actor.token).send(data);
before(async () => {
  await connectDatabase(uri);
  app = createApp({
    mongoUri: uri,
    secret: "test-only-secret-32-characters-long-never-deploy",
  });
  client = await actor("client@test.ru", "client");
  other = await actor("other@test.ru", "client");
  manager = await actor("manager@test.ru", "manager");
  admin = await actor("admin@test.ru", "admin");
  car = await Car.create(carData);
});
after(async () => {
  await app.locals.sessionStore.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test("MongoDB отвечает; каталог возвращает сохранённый автомобиль", async () => {
  assert.equal(
    (await request(app).get("/api/health")).body.database,
    "connected",
  );
  const r = await client.agent.get("/api/cars?search=Test");
  assert.equal(r.status, 200);
  assert.equal(r.body.cars.length, 1);
  assert.equal(r.body.cars[0].dailyRate, 4000);
});
test("Регистрация: пароль хешируется, роль назначается сервером", async () => {
  const agent = request.agent(app);
  let r = await agent.get("/api/auth/session");
  r = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", r.body.csrfToken)
    .send({
      name: "Новый клиент",
      email: "NEW@test.ru",
      phone: "+79001112233",
      ageConfirmed: true,
      licenseConfirmed: true,
      drivingExperience: 3,
      password: "Testpass2026!",
    });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, "client");
  assert.equal(r.body.user.email, "new@test.ru");
  const u = await User.findOne({ email: "new@test.ru" }).select(
    "+passwordHash",
  );
  assert.notEqual(u.passwordHash, "Testpass2026!");
  assert.ok(await bcrypt.compare("Testpass2026!", u.passwordHash));
});
test("Самостоятельное назначение роли администратора запрещено", async () => {
  const r = await mutation(other, "post", "/api/auth/register", {
    name: "Атакующий",
    email: "role@test.ru",
    phone: "+79001112233",
    ageConfirmed: true,
    licenseConfirmed: true,
    drivingExperience: 3,
    password: "Testpass2026!",
    role: "admin",
  });
  assert.equal(r.status, 400);
  assert.equal(await User.countDocuments({ email: "role@test.ru" }), 0);
});
test("Повторный email и неверный пароль отклоняются", async () => {
  assert.equal(
    (
      await mutation(other, "post", "/api/auth/register", {
        name: "Клиент",
        email: "client@test.ru",
        phone: "+79001112233",
        ageConfirmed: true,
        licenseConfirmed: true,
        drivingExperience: 3,
        password: "Testpass2026!",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await mutation(other, "post", "/api/auth/login", {
        email: "client@test.ru",
        password: "Wrongpass2026!",
      })
    ).status,
    401,
  );
});
test("CSRF: запрос без токена отклоняется", async () => {
  assert.equal(
    (
      await client.agent
        .patch("/api/profile")
        .send({ name: "Плохое имя", phone: "+79001112233" })
    ).status,
    403,
  );
});
test("Гость и клиент не имеют доступа к управлению", async () => {
  assert.equal((await request(app).get("/api/admin/overview")).status, 401);
  assert.equal((await client.agent.get("/api/admin/overview")).status, 403);
  assert.equal((await manager.agent.get("/api/admin/users")).status, 403);
  assert.equal(
    (await mutation(manager, "post", "/api/admin/cars", carData)).status,
    403,
  );
});
test("Цена рассчитывается сервером; присланная сумма не принимается", async () => {
  const r = await mutation(client, "post", "/api/quote", {
    carId: String(car._id),
    from: today(),
    to: tomorrow(),
    extras: { insurance: true },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.quote.total, 9200);
  assert.equal(
    (
      await mutation(client, "post", "/api/rentals", {
        carId: String(car._id),
        from: today(),
        to: tomorrow(),
        total: 1,
      })
    ).status,
    400,
  );
});
test("Две параллельные заявки: одна сохранена, другая отклонена", async () => {
  const data = {
    carId: String(car._id),
    from: today(),
    to: tomorrow(),
    extras: {},
  };
  const responses = await Promise.all([
    mutation(client, "post", "/api/rentals", data),
    mutation(client, "post", "/api/rentals", data),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  rentalId = responses.find((r) => r.status === 201).body.rental._id;
  assert.equal(await Rental.countDocuments({ car: car._id }), 1);
  assert.equal(await Event.countDocuments({ action: "Новая заявка" }), 1);
});
test("Фильтр дат исключает занятый автомобиль; чужие заявки не видны", async () => {
  const r = await client.agent.get(
    `/api/cars?from=${today()}&to=${tomorrow()}`,
  );
  assert.equal(r.body.cars.length, 0);
  assert.equal((await other.agent.get("/api/rentals")).body.rentals.length, 0);
  assert.equal(
    (
      await mutation(other, "patch", `/api/rentals/${rentalId}/status`, {
        status: "cancelled",
      })
    ).status,
    404,
  );
});
test("Нельзя архивировать или ремонтировать авто с бронью", async () => {
  assert.equal(
    (await mutation(admin, "delete", `/api/admin/cars/${car._id}`)).status,
    409,
  );
  assert.equal(
    (
      await mutation(manager, "patch", `/api/admin/cars/${car._id}`, {
        status: "maintenance",
      })
    ).status,
    409,
  );
});
test("Менеджер проводит аренду по статусам, пробег обновляется", async () => {
  assert.equal(
    (
      await mutation(client, "patch", `/api/rentals/${rentalId}/status`, {
        status: "confirmed",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await mutation(manager, "patch", `/api/rentals/${rentalId}/status`, {
        status: "completed",
        returnMileage: 1100,
      })
    ).status,
    409,
  );
  for (const status of ["confirmed", "active"])
    assert.equal(
      (
        await mutation(manager, "patch", `/api/rentals/${rentalId}/status`, {
          status,
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await mutation(manager, "patch", `/api/rentals/${rentalId}/status`, {
        status: "completed",
        returnMileage: 100,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await mutation(manager, "patch", `/api/rentals/${rentalId}/status`, {
        status: "completed",
        returnMileage: 1200,
      })
    ).status,
    200,
  );
  assert.equal((await Car.findById(car._id)).mileage, 1200);
  assert.equal((await Rental.findById(rentalId)).history.length, 4);
});
test("Отмена освобождает автомобиль, соседние интервалы разрешены", async () => {
  const a = await mutation(client, "post", "/api/rentals", {
    carId: String(car._id),
    from: today(),
    to: tomorrow(),
  });
  assert.equal(a.status, 201);
  const next = new Date(tomorrow());
  next.setUTCDate(next.getUTCDate() + 2);
  const b = await mutation(other, "post", "/api/rentals", {
    carId: String(car._id),
    from: tomorrow(),
    to: next.toISOString().slice(0, 10),
  });
  assert.equal(b.status, 201);
  for (const [actor, r] of [
    [client, a],
    [other, b],
  ])
    assert.equal(
      (
        await mutation(
          actor,
          "patch",
          `/api/rentals/${r.body.rental._id}/status`,
          { status: "cancelled" },
        )
      ).status,
      200,
    );
});
test("CRUD автомобиля и осмотры сохраняются в базе, история сохраняется при архивировании", async () => {
  let r = await mutation(admin, "post", "/api/admin/cars", {
    ...carData,
    plate: "ТЕСТ002",
  });
  assert.equal(r.status, 201);
  const c = r.body.car;
  assert.equal(
    (
      await mutation(admin, "patch", `/api/admin/cars/${c._id}`, {
        dailyRate: 4500,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await mutation(manager, "post", "/api/admin/maintenance", {
        carId: c._id,
        node: "Тормоза",
        wear: 78,
        mileage: 1100,
        note: "Заменить колодки",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await mutation(manager, "post", "/api/admin/maintenance", {
        carId: c._id,
        node: "Тормоза",
        wear: 101,
        mileage: 1100,
        note: "Ошибка",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await mutation(manager, "patch", `/api/admin/cars/${c._id}`, {
        status: "broken",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await mutation(client, "post", "/api/rentals", {
        carId: c._id,
        from: today(),
        to: tomorrow(),
      })
    ).status,
    409,
  );
  assert.equal(
    (await mutation(admin, "delete", `/api/admin/cars/${c._id}`)).status,
    200,
  );
  assert.equal((await client.agent.get("/api/cars/" + c._id)).status, 404);
  assert.equal((await Car.findById(c._id)).archived, true);
});
test("Изменение роли действует для существующей сессии", async () => {
  const u = await User.findOne({ email: "other@test.ru" });
  assert.equal(
    (
      await mutation(admin, "patch", `/api/admin/users/${u._id}`, {
        role: "manager",
      })
    ).status,
    200,
  );
  assert.equal((await other.agent.get("/api/admin/overview")).status, 200);
  const self = await User.findOne({ email: "admin@test.ru" });
  assert.equal(
    (
      await mutation(admin, "patch", `/api/admin/users/${self._id}`, {
        role: "client",
      })
    ).status,
    400,
  );
});
test("CSV выгружается, некорректные идентификаторы отклоняются", async () => {
  const r = await manager.agent.get("/api/admin/export");
  assert.equal(r.status, 200);
  assert.match(r.text, /AB-/);
  assert.equal((await client.agent.get("/api/cars/bad-id")).status, 400);
});
test("Выход завершает сессию", async () => {
  assert.equal(
    (await mutation(client, "post", "/api/auth/logout")).status,
    200,
  );
  assert.equal((await client.agent.get("/api/rentals")).status, 401);
});
test("Телефон из знаков пунктуации не принимается", async () => {
  const r = await mutation(admin, "patch", "/api/profile", {
    name: "Проверка телефона",
    phone: "()()()()()",
  });
  assert.equal(r.status, 400);
});
test("Пароль длиннее 72 байт отклоняется до хеширования bcrypt", async () => {
  const agent = request.agent(app);
  const session = await agent.get("/api/auth/session");
  const r = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", session.body.csrfToken)
    .send({
      name: "Проверка пароля",
      email: "unicode@test.ru",
      phone: "+79001234567",
      ageConfirmed: true,
      licenseConfirmed: true,
      drivingExperience: 3,
      password: "Я".repeat(40),
    });
  assert.equal(r.status, 400);
});

test("Телефон нормализуется; иностранный и короткий номера отклоняются", async () => {
  const valid = await mutation(admin, "patch", "/api/profile", {
    name: "Администратор теста",
    phone: "8 (921) 555-44-33",
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.user.phone, "+79215554433");
  for (const phone of ["+12025550123", "+7 (921)-555"])
    assert.equal(
      (
        await mutation(admin, "patch", "/api/profile", {
          name: "Администратор теста",
          phone,
        })
      ).status,
      400,
    );
});
test("Фото: доступ только администратору, проверка байтов и сохранение ссылки", async () => {
  const sharp = (await import("sharp")).default;
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  const data = "data:image/png;base64," + bytes.toString("base64");
  assert.equal(
    (await mutation(manager, "post", "/api/admin/photos", { data })).status,
    403,
  );
  assert.equal(
    (
      await mutation(admin, "post", "/api/admin/photos", {
        data: "data:image/png;base64,YmFk",
      })
    ).status,
    400,
  );
  const r = await mutation(admin, "post", "/api/admin/photos", { data });
  assert.equal(r.status, 201);
  assert.match(r.body.image, /^\/uploads\/[a-f0-9]{32}\.webp$/);
  try {
    assert.equal(
      (
        await mutation(admin, "patch", `/api/admin/cars/${car._id}`, {
          image: r.body.image,
        })
      ).status,
      200,
    );
    assert.equal((await request(app).get(r.body.image)).status, 200);
    assert.equal(
      (
        await mutation(admin, "patch", `/api/admin/cars/${car._id}`, {
          image: "javascript:alert(1)",
        })
      ).status,
      400,
    );
  } finally {
    await (await import("node:fs/promises")).unlink("." + r.body.image);
  }
});

test("Регистрация требует возраст, права и полный год стажа", async () => {
  const agent = request.agent(app);
  const session = await agent.get("/api/auth/session");
  const valid = {
    name: "Проверка условий",
    email: "eligibility@test.ru",
    phone: "+79001234567",
    password: "Testpass2026!",
    ageConfirmed: true,
    licenseConfirmed: true,
    drivingExperience: 1,
  };
  for (const invalid of [
    { ageConfirmed: false },
    { licenseConfirmed: false },
    { drivingExperience: 0 },
    { drivingExperience: 0.5 },
    { ageConfirmed: "true" },
    { drivingExperience: undefined },
  ]) {
    const r = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", session.body.csrfToken)
      .send({ ...valid, ...invalid });
    assert.equal(r.status, 400);
  }
  const r = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", session.body.csrfToken)
    .send(valid);
  assert.equal(r.status, 201);
  assert.equal(r.body.user.drivingExperience, 1);
  assert.equal(r.body.user.licenseConfirmed, true);
});
test("Старый профиль не бронирует до подтверждения условий", async () => {
  await User.updateOne(
    { email: "other@test.ru" },
    {
      $unset: { drivingExperience: 1 },
      $set: { ageConfirmed: false, licenseConfirmed: false },
    },
  );
  const r = await mutation(other, "post", "/api/rentals", {});
  assert.equal(r.status, 403);
  const profile = await mutation(other, "patch", "/api/profile", {
    name: "Старый клиент",
    phone: "+79001234567",
    ageConfirmed: true,
    licenseConfirmed: true,
    drivingExperience: 1,
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.drivingExperience, 1);
  const next = await mutation(other, "post", "/api/rentals", {});
  assert.equal(next.status, 400); // passes eligibility and reaches booking payload validation
});
