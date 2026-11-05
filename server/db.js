import mongoose from "mongoose";
import { User, Car, Rental, Maintenance, Event } from "./models.js";
export async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await Promise.all(
    [User, Car, Rental, Maintenance, Event].map((m) => m.init()),
  );
}
