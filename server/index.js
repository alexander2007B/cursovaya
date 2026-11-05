import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "./db.js";
import { createApp } from "./app.js";
await connectDatabase(process.env.MONGODB_URI);
const app = createApp({
  mongoUri: process.env.MONGODB_URI,
  secret: process.env.SESSION_SECRET,
  production: process.env.NODE_ENV === "production",
});
const server = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log(
    `АВТОБАЗА: сервер запущен, порт ${Number(process.env.PORT) || 3000}, MongoDB подключена`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await app.locals.sessionStore.close();
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
