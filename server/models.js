import mongoose from "mongoose";
const { Schema, model } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    ageConfirmed: { type: Boolean, default: false },
    licenseConfirmed: { type: Boolean, default: false },
    drivingExperience: { type: Number, min: 1, max: 80 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["client", "manager", "admin"],
      default: "client",
    },
  },
  { timestamps: true },
);
const carSchema = new Schema(
  {
    brand: String,
    model: String,
    year: Number,
    plate: { type: String, unique: true },
    category: { type: String, enum: ["economy", "comfort", "business", "suv"] },
    dailyRate: Number,
    deposit: Number,
    mileage: Number,
    seats: Number,
    transmission: { type: String, enum: ["Автомат", "Механика"] },
    fuel: String,
    image: String,
    description: String,
    status: {
      type: String,
      enum: ["available", "maintenance", "broken"],
      default: "available",
    },
    archived: { type: Boolean, default: false },
    lockVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
carSchema.index({ archived: 1, category: 1, dailyRate: 1 });
const rentalSchema = new Schema(
  {
    number: { type: String, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true },
    carName: String,
    from: String,
    to: String,
    extras: { insurance: Boolean, childSeat: Boolean },
    quote: {
      days: Number,
      dailyRate: Number,
      base: Number,
      insurance: Number,
      childSeat: Number,
      total: Number,
      deposit: Number,
    },
    status: {
      type: String,
      enum: ["new", "confirmed", "active", "completed", "cancelled"],
      default: "new",
    },
    comment: String,
    returnMileage: Number,
    history: [
      {
        status: String,
        at: Date,
        by: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true },
);
rentalSchema.index({ car: 1, status: 1, from: 1, to: 1 });
rentalSchema.index({ user: 1, createdAt: -1 });
const maintenanceSchema = new Schema(
  {
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    node: String,
    wear: Number,
    mileage: Number,
    note: String,
  },
  { timestamps: true },
);
maintenanceSchema.index({ car: 1, createdAt: -1 });
const eventSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    action: String,
    entity: String,
    details: String,
  },
  { timestamps: true },
);
eventSchema.index({ createdAt: -1 });
export const User = model("User", userSchema);
export const Car = model("Car", carSchema);
export const Rental = model("Rental", rentalSchema);
export const Maintenance = model("Maintenance", maintenanceSchema);
export const Event = model("Event", eventSchema);
export const publicUser = (u) => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  phone: u.phone,
  ageConfirmed: u.ageConfirmed,
  licenseConfirmed: u.licenseConfirmed,
  drivingExperience: u.drivingExperience,
  role: u.role,
});
