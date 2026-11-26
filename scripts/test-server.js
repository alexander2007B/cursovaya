import "dotenv/config";
import mongoose from "mongoose";
import { execFileSync } from "node:child_process";
const uri =
  "mongodb://127.0.0.1:27017/avtobaza_e2e?replicaSet=rs0&directConnection=true";
// This dedicated database belongs only to the browser test runner.
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
process.env.MONGODB_URI = uri;
process.env.PORT = "3001";
process.env.NODE_ENV = "test";
process.env.SEED_DEMO = "true";
process.env.SESSION_SECRET = "e2e-only-not-for-production-secret-32-characters";
execFileSync(process.execPath, ["scripts/seed.js"], {
  env: process.env,
  stdio: "inherit",
});
await import("../server/index.js");
