import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { normalizeRussianPhone } from "../shared/phone.js";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z, ZodError } from "zod";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { User, Car, Rental, Maintenance, Event, publicUser } from "./models.js";
import {
  AppError,
  calculateQuote,
  validateTransition,
  today,
} from "./domain.js";

const id = z.string().regex(/^[a-f\d]{24}$/i, "Некорректный идентификатор");
const phone = z.string().transform((value, ctx) => {
  try {
    return normalizeRussianPhone(value);
  } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
    return z.NEVER;
  }
});
const credentials = z.object({
  email: z
    .string()
    .trim()
    .email("Некорректный email")
    .max(120)
    .transform((s) => s.toLowerCase()),
  password: z
    .string()
    .min(8, "Пароль должен содержать не менее 8 символов")
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Пароль не должен превышать 72 байта UTF-8",
    ),
});
const registration = credentials
  .extend({ name: z.string().trim().min(2).max(80), phone })
  .strict();
const carInput = z
  .object({
    brand: z.string().trim().min(1).max(40),
    model: z.string().trim().min(1).max(60),
    year: z
      .number()
      .int()
      .min(2000)
      .max(new Date().getFullYear() + 1),
    plate: z
      .string()
      .trim()
      .min(5)
      .max(15)
      .transform((s) => s.toUpperCase()),
    category: z.enum(["economy", "comfort", "business", "suv"]),
    dailyRate: z.number().int().min(500).max(100000),
    deposit: z.number().int().min(0).max(500000),
    mileage: z.number().int().min(0).max(2000000),
    seats: z.number().int().min(2).max(9),
    transmission: z.enum(["Автомат", "Механика"]),
    fuel: z.string().trim().min(1).max(30),
    image: z
      .string()
      .regex(
        /^\/(?:images\/[a-zA-Z0-9_/-]+\.(?:svg|jpg|jpeg|png|webp)|uploads\/[a-f0-9]{32}\.webp)$/,
      ),
    description: z.string().trim().min(10).max(1500),
    status: z.enum(["available", "maintenance", "broken"]),
  })
  .strict();
const bookingInput = z
  .object({
    carId: id,
    from: z.string(),
    to: z.string(),
    extras: z
      .object({
        insurance: z.boolean().default(false),
        childSeat: z.boolean().default(false),
      })
      .default({}),
    comment: z.string().trim().max(500).default(""),
  })
  .strict();
const blocking = ["new", "confirmed", "active"];
const overlap = (car, from, to) => ({
  car,
  status: { $in: blocking },
  from: { $lt: to },
  to: { $gt: from },
});
const event = (req, action, entity, details, dbSession) =>
  Event.create(
    [{ actor: req.user._id, action, entity: String(entity), details }],
    dbSession ? { session: dbSession } : {},
  );

export function createApp({ mongoUri, secret, production = false }) {
  if (!secret || secret.length < 32 || secret.startsWith("replace-"))
    throw new Error("Задайте случайный SESSION_SECRET длиной от 32 символов");
  const app = express();
  app.disable("x-powered-by");
  // Compress static files and public catalogue data, never session/token responses.
  app.use(
    compression({
      filter: (req, res) =>
        (req.path.startsWith("/api/cars") || !req.path.startsWith("/api/")) &&
        compression.filter(req, res),
    }),
  );
  app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
  app.use(express.json({ limit: "6mb" }));
  const store = MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: "sessions",
    ttl: 60 * 60 * 24 * 7,
  });
  app.locals.sessionStore = store;
  app.use(
    session({
      name: "avtobaza.sid",
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );
  // Re-read roles from the database on every request: role revocation takes effect immediately.
  app.use("/api", async (req, res, next) => {
    if (req.session.userId) req.user = await User.findById(req.session.userId);
    next();
  });
  app.get("/api/health", async (req, res) => {
    await mongoose.connection.db.admin().ping();
    res.json({ status: "ok", database: "connected" });
  });
  app.get("/api/auth/session", (req, res) => {
    req.session.csrf ||= randomBytes(32).toString("hex");
    res.set("Cache-Control", "no-store").json({
      user: req.user ? publicUser(req.user) : null,
      csrfToken: req.session.csrf,
    });
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (!req.session.csrf || req.get("X-CSRF-Token") !== req.session.csrf)
    )
      return next(
        new AppError(
          403,
          "Сессия устарела. Обновите страницу и повторите действие",
        ),
      );
    next();
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Слишком много попыток. Повторите через 15 минут" },
  });
  async function signIn(req, user) {
    await new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.userId = user._id.toString();
    req.session.csrf = randomBytes(32).toString("hex");
    await new Promise((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
    return { user: publicUser(user), csrfToken: req.session.csrf };
  }
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const data = registration.parse(req.body);
    const user = await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: await bcrypt.hash(data.password, 12),
    });
    res.status(201).json(await signIn(req, user));
  });
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const data = credentials.strict().parse(req.body);
    const user = await User.findOne({ email: data.email }).select(
      "+passwordHash",
    );
    const hash =
      user?.passwordHash ||
      "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxA2dH2CAyXJv8cQ.j9NSmQpu3W";
    if (!(await bcrypt.compare(data.password, hash)) || !user)
      throw new AppError(401, "Неверный email или пароль");
    res.json(await signIn(req, user));
  });
  app.post("/api/auth/logout", async (req, res) => {
    await new Promise((resolve, reject) =>
      req.session.destroy((e) => (e ? reject(e) : resolve())),
    );
    res.clearCookie("avtobaza.sid");
    res.json({ ok: true });
  });
  const requireUser = (req, res, next) =>
    req.user ? next() : next(new AppError(401, "Войдите в аккаунт"));
  const requireStaff = (req, res, next) =>
    ["manager", "admin"].includes(req.user?.role)
      ? next()
      : next(new AppError(403, "Доступ только для сотрудников"));
  const requireAdmin = (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : next(new AppError(403, "Доступ только для администратора"));
  app.patch("/api/profile", requireUser, async (req, res) => {
    const data = z
      .object({ name: z.string().trim().min(2).max(80), phone })
      .strict()
      .parse(req.body);
    Object.assign(req.user, data);
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  });
  app.get("/api/cars", async (req, res) => {
    const query = z
      .object({
        category: z
          .enum(["all", "economy", "comfort", "business", "suv"])
          .default("all"),
        search: z.string().max(80).default(""),
        sort: z.enum(["price", "price-desc", "year"]).default("price"),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);
    const filter = { archived: false };
    if (query.category !== "all") filter.category = query.category;
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { brand: new RegExp(escaped, "i") },
        { model: new RegExp(escaped, "i") },
      ];
    }
    if (query.from || query.to) {
      calculateQuote(
        { dailyRate: 1, deposit: 0 },
        query.from || "",
        query.to || "",
      );
      const occupied = await Rental.distinct("car", {
        status: { $in: blocking },
        from: { $lt: query.to },
        to: { $gt: query.from },
      });
      filter._id = { $nin: occupied };
      filter.status = "available";
    }
    const cars = await Car.find(filter)
      .select("-lockVersion -__v")
      .sort(
        query.sort === "year"
          ? { year: -1 }
          : { dailyRate: query.sort === "price-desc" ? -1 : 1 },
      )
      .lean();
    const active = await Rental.distinct("car", { status: "active" });
    const rented = new Set(active.map(String));
    res.json({
      cars: cars.map((c) => ({
        ...c,
        displayStatus: rented.has(String(c._id)) ? "rented" : c.status,
      })),
    });
  });
  app.get("/api/cars/:id", async (req, res) => {
    const car = await Car.findOne({
      _id: id.parse(req.params.id),
      archived: false,
    })
      .select("-lockVersion -__v")
      .lean();
    if (!car) throw new AppError(404, "Автомобиль не найден");
    const reservations = await Rental.find({
      car: car._id,
      status: { $in: blocking },
      to: { $gte: today() },
    }).select("from to -_id");
    res.json({ car, reservations });
  });
  app.post("/api/quote", async (req, res) => {
    const data = bookingInput.parse(req.body);
    const car = await Car.findOne({ _id: data.carId, archived: false });
    if (!car) throw new AppError(404, "Автомобиль не найден");
    const quote = calculateQuote(car, data.from, data.to, data.extras);
    const busy = await Rental.exists(overlap(car._id, data.from, data.to));
    res.json({ quote, available: car.status === "available" && !busy });
  });
  app.post("/api/rentals", requireUser, async (req, res) => {
    const data = bookingInput.parse(req.body);
    let rental;
    await mongoose.connection.transaction(async (dbSession) => {
      // Writing the car first serializes every reservation/status change for this car.
      // MongoDB retries conflicting transactions and the overlap check sees the winner.
      const car = await Car.findOneAndUpdate(
        { _id: data.carId, archived: false },
        { $inc: { lockVersion: 1 } },
        { new: true, session: dbSession },
      );
      if (!car) throw new AppError(404, "Автомобиль не найден");
      const quote = calculateQuote(car, data.from, data.to, data.extras);
      if (
        car.status !== "available" ||
        (await Rental.exists(overlap(car._id, data.from, data.to)).session(
          dbSession,
        ))
      )
        throw new AppError(
          409,
          "Автомобиль недоступен на эти даты. Выберите другой период",
        );
      [rental] = await Rental.create(
        [
          {
            number: `AB-${randomBytes(4).toString("hex").toUpperCase()}`,
            user: req.user._id,
            car: car._id,
            carName: `${car.brand} ${car.model}`,
            from: data.from,
            to: data.to,
            extras: data.extras,
            comment: data.comment,
            quote,
            history: [{ status: "new", at: new Date(), by: req.user._id }],
          },
        ],
        { session: dbSession },
      );
      await event(
        req,
        "Новая заявка",
        rental._id,
        `${rental.number} · ${rental.carName}`,
        dbSession,
      );
    });
    res.status(201).json({ rental });
  });
  app.get("/api/rentals", requireUser, async (req, res) => {
    const rentals = await Rental.find({ user: req.user._id })
      .populate("car", "image brand model plate")
      .sort({ createdAt: -1 });
    res.json({ rentals });
  });
  app.patch("/api/rentals/:id/status", requireUser, async (req, res) => {
    const data = z
      .object({
        status: z.enum(["confirmed", "active", "completed", "cancelled"]),
        returnMileage: z.number().int().min(0).max(2000000).optional(),
      })
      .strict()
      .parse(req.body);
    const rentalId = id.parse(req.params.id);
    let result;
    await mongoose.connection.transaction(async (dbSession) => {
      const initial = await Rental.findById(rentalId).session(dbSession);
      if (
        !initial ||
        (req.user.role === "client" && !initial.user.equals(req.user._id))
      )
        throw new AppError(404, "Аренда не найдена");
      const car = await Car.findByIdAndUpdate(
        initial.car,
        { $inc: { lockVersion: 1 } },
        { new: true, session: dbSession },
      );
      const rental = await Rental.findById(rentalId).session(dbSession);
      validateTransition(rental.status, data.status, req.user.role);
      if (data.status === "confirmed" && car.status !== "available")
        throw new AppError(409, "Автомобиль недоступен");
      if (data.status === "active") {
        if (
          car.status !== "available" ||
          rental.from > today() ||
          rental.to <= today()
        )
          throw new AppError(
            409,
            "Выдача возможна только в период аренды для исправного автомобиля",
          );
        if (
          await Rental.exists({
            car: car._id,
            status: "active",
            _id: { $ne: rental._id },
          }).session(dbSession)
        )
          throw new AppError(409, "Автомобиль ещё не возвращён");
      }
      if (data.status === "completed") {
        if (
          data.returnMileage === undefined ||
          data.returnMileage < car.mileage
        )
          throw new AppError(
            400,
            "Укажите пробег при возврате, не меньше текущего",
          );
        car.mileage = data.returnMileage;
        await car.save({ session: dbSession });
        rental.returnMileage = data.returnMileage;
      }
      rental.status = data.status;
      rental.history.push({
        status: data.status,
        at: new Date(),
        by: req.user._id,
      });
      await rental.save({ session: dbSession });
      await event(
        req,
        "Статус аренды",
        rental._id,
        `${rental.number} → ${data.status}`,
        dbSession,
      );
      result = rental;
    });
    res.json({ rental: result });
  });
  app.use("/api/admin", requireUser, requireStaff);
  app.post("/api/admin/photos", requireAdmin, async (req, res) => {
    const { data } = z
      .object({
        data: z
          .string()
          .max(5600000)
          .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
      })
      .strict()
      .parse(req.body);
    const bytes = Buffer.from(data.split(",")[1], "base64");
    if (bytes.length > 4 * 1024 * 1024)
      throw new AppError(400, "Фото должно быть не больше 4 МБ");
    let output;
    try {
      output = await sharp(bytes, { limitInputPixels: 20000000 })
        .rotate()
        .resize({
          width: 1400,
          height: 1000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new AppError(400, "Не удалось прочитать изображение");
    }
    await mkdir("uploads", { recursive: true });
    const name = randomBytes(16).toString("hex") + ".webp";
    await writeFile(path.join("uploads", name), output, { flag: "wx" });
    res.status(201).json({ image: "/uploads/" + name });
  });
  app.get("/api/admin/overview", async (req, res) => {
    const [cars, rentals, events, clients] = await Promise.all([
      Car.find({ archived: false }).select("-lockVersion"),
      Rental.find()
        .populate("user", "name email phone")
        .populate("car", "brand model image plate mileage")
        .sort({ createdAt: -1 }),
      Event.find().populate("actor", "name").sort({ createdAt: -1 }).limit(50),
      User.countDocuments({ role: "client" }),
    ]);
    res.json({
      cars,
      rentals,
      events,
      stats: {
        cars: cars.length,
        active: rentals.filter((r) => r.status === "active").length,
        pending: rentals.filter((r) => r.status === "new").length,
        revenue: rentals
          .filter((r) => r.status === "completed")
          .reduce((n, r) => n + r.quote.total, 0),
        clients,
      },
    });
  });
  app.post("/api/admin/cars", requireAdmin, async (req, res) => {
    const car = await Car.create(carInput.parse(req.body));
    await event(
      req,
      "Добавлен автомобиль",
      car._id,
      `${car.brand} ${car.model}`,
    );
    res.status(201).json({ car });
  });
  app.patch("/api/admin/cars/:id", async (req, res) => {
    const carId = id.parse(req.params.id);
    const data =
      req.user.role === "admin"
        ? carInput.partial().parse(req.body)
        : z
            .object({ status: z.enum(["available", "maintenance", "broken"]) })
            .strict()
            .parse(req.body);
    let result;
    await mongoose.connection.transaction(async (dbSession) => {
      const car = await Car.findOneAndUpdate(
        { _id: carId, archived: false },
        { $inc: { lockVersion: 1 } },
        { new: true, session: dbSession },
      );
      if (!car) throw new AppError(404, "Автомобиль не найден");
      if (data.mileage !== undefined && data.mileage < car.mileage)
        throw new AppError(400, "Пробег нельзя уменьшать");
      if (
        data.status &&
        data.status !== "available" &&
        (await Rental.exists({ car: carId, status: { $in: blocking } }).session(
          dbSession,
        ))
      )
        throw new AppError(
          409,
          "Сначала отмените ожидающие заявки и завершите активную аренду",
        );
      Object.assign(car, data);
      await car.save({ session: dbSession });
      await event(
        req,
        "Изменён автомобиль",
        car._id,
        `${car.brand} ${car.model}`,
        dbSession,
      );
      result = car;
    });
    res.json({ car: result });
  });
  app.delete("/api/admin/cars/:id", requireAdmin, async (req, res) => {
    const carId = id.parse(req.params.id);
    await mongoose.connection.transaction(async (dbSession) => {
      const car = await Car.findOneAndUpdate(
        { _id: carId, archived: false },
        { $inc: { lockVersion: 1 } },
        { new: true, session: dbSession },
      );
      if (!car) throw new AppError(404, "Автомобиль не найден");
      if (
        await Rental.exists({ car: carId, status: { $in: blocking } }).session(
          dbSession,
        )
      )
        throw new AppError(
          409,
          "Нельзя убрать автомобиль с незавершёнными арендами",
        );
      car.archived = true;
      await car.save({ session: dbSession });
      await event(
        req,
        "Автомобиль в архиве",
        car._id,
        `${car.brand} ${car.model}`,
        dbSession,
      );
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/maintenance", async (req, res) => {
    res.json({
      records: await Maintenance.find()
        .populate("car", "brand model plate")
        .populate("author", "name")
        .sort({ createdAt: -1 })
        .limit(200),
    });
  });
  app.post("/api/admin/maintenance", async (req, res) => {
    const data = z
      .object({
        carId: id,
        node: z.enum([
          "Двигатель",
          "Тормоза",
          "Подвеска",
          "Шины",
          "Кузов",
          "Плановое ТО",
        ]),
        wear: z.number().int().min(0).max(100),
        mileage: z.number().int().min(0).max(2000000),
        note: z.string().trim().min(3).max(1000),
      })
      .strict()
      .parse(req.body);
    let record;
    await mongoose.connection.transaction(async (dbSession) => {
      const car = await Car.findOneAndUpdate(
        { _id: data.carId, archived: false },
        { $inc: { lockVersion: 1 } },
        { new: true, session: dbSession },
      );
      if (!car) throw new AppError(404, "Автомобиль не найден");
      if (data.mileage < car.mileage)
        throw new AppError(400, "Пробег осмотра не может быть меньше текущего");
      car.mileage = data.mileage;
      await car.save({ session: dbSession });
      [record] = await Maintenance.create(
        [{ ...data, car: car._id, author: req.user._id }],
        { session: dbSession },
      );
      await event(
        req,
        "Технический осмотр",
        car._id,
        `${car.brand} ${car.model} · ${data.node} · износ ${data.wear}%`,
        dbSession,
      );
    });
    res.status(201).json({ record });
  });
  app.get("/api/admin/users", requireAdmin, async (req, res) =>
    res.json({
      users: (await User.find().sort({ createdAt: -1 })).map(publicUser),
    }),
  );
  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const userId = id.parse(req.params.id);
    const { role } = z
      .object({ role: z.enum(["client", "manager", "admin"]) })
      .strict()
      .parse(req.body);
    if (userId === req.user._id.toString())
      throw new AppError(400, "Нельзя изменить собственную роль");
    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    if (!user) throw new AppError(404, "Пользователь не найден");
    await event(req, "Изменена роль", user._id, `${user.email} → ${role}`);
    res.json({ user: publicUser(user) });
  });
  app.get("/api/admin/export", async (req, res) => {
    const rentals = await Rental.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    const cell = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Номер",
        "Клиент",
        "Email",
        "Автомобиль",
        "С",
        "По",
        "Статус",
        "Стоимость, руб.",
      ],
      ...rentals.map((r) => [
        r.number,
        r.user?.name,
        r.user?.email,
        r.carName,
        r.from,
        r.to,
        r.status,
        r.quote.total,
      ]),
    ];
    res
      .attachment("rentals.csv")
      .type("text/csv")
      .send("\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n"));
  });
  app.use("/api", (req, res, next) =>
    next(new AppError(404, "Маршрут не найден")),
  );
  app.use(
    "/uploads",
    express.static(path.resolve("uploads"), { dotfiles: "deny", index: false }),
  );
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((error, req, res, next) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        message: "Проверьте заполнение полей",
        fields: error.flatten().fieldErrors,
      });
    if (error.code === 11000)
      return res.status(409).json({
        message: "Такой email, госномер или номер записи уже используется",
      });
    if (error instanceof AppError)
      return res.status(error.status).json({ message: error.message });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ message: "Некорректный JSON" });
    console.error("Request failed:", error.name, error.message);
    res
      .status(500)
      .json({ message: "Не удалось выполнить запрос. Попробуйте позже" });
  });
  return app;
}
