import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

try {
  writeFileSync(
    ".env",
    `PORT=3000\nMONGODB_URI=mongodb://127.0.0.1:27017/avtobaza?replicaSet=rs0&directConnection=true\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nNODE_ENV=development\nSEED_DEMO=true\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Файл .env создан. Можно запускать MongoDB.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Файл .env уже существует и оставлен без изменений.");
}
