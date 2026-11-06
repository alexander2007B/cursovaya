import { fleet, legacyFleet, photoUpgrade } from "../shared/fleet.js";
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "../server/db.js";
import { User, Car, Maintenance, Event } from "../server/models.js";
if (process.env.NODE_ENV === "production" || process.env.SEED_DEMO !== "true")
  throw new Error(
    "Демо-данные разрешены только при SEED_DEMO=true вне production",
  );
await connectDatabase(process.env.MONGODB_URI);
const passwordHash = await bcrypt.hash("Avtobaza2026!", 12);
for (const [name, email, role] of [
  ["Администратор", "admin@avtobaza.test", "admin"],
  ["Анна Миронова", "manager@avtobaza.test", "manager"],
  ["Александр Баев", "client@avtobaza.test", "client"],
]) {
  await User.updateOne(
    { email },
    {
      $setOnInsert: {
        name,
        email,
        role,
        phone: "+7 900 123-45-67",
        ageConfirmed: true,
        licenseConfirmed: true,
        drivingExperience: 3,
        passwordHash,
      },
    },
    { upsert: true },
  );
}
for (const car of fleet) {
  await Car.updateOne(
    { plate: car.plate },
    { $setOnInsert: car },
    { upsert: true },
  );
}
for (const old of legacyFleet) {
  const existing = await Car.findOne({
    plate: old.plate,
    brand: old.brand,
    model: old.model,
  });
  if (existing) {
    const patch = photoUpgrade(existing);
    if (patch)
      await Car.updateOne(
        { _id: existing._id, image: existing.image },
        { $set: patch },
      );
  }
}
const admin = await User.findOne({ email: "admin@avtobaza.test" }),
  serviceCar = await Car.findOne({ plate: "К707КК52" });
if (!(await Maintenance.exists({ car: serviceCar._id })))
  await Maintenance.create({
    car: serviceCar._id,
    author: admin._id,
    node: "Тормоза",
    wear: 78,
    mileage: serviceCar.mileage,
    note: "Плановая замена передних тормозных колодок. Автомобиль временно снят с выдачи.",
  });
if (!(await Event.exists({ action: "Подготовлен автопарк" })))
  await Event.create({
    actor: admin._id,
    action: "Подготовлен автопарк",
    entity: "seed",
    details: "Подготовлены автомобили и учебные аккаунты",
  });
console.log("Демо-данные готовы. Существующие записи сохранены.");
await mongoose.disconnect();
