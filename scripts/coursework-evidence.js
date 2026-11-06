import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import autocannon from "autocannon";
import { connectDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { User, Car, Rental, Maintenance, Event } from "../server/models.js";
const mongoUri =
  "mongodb://127.0.0.1:27017/norde_coursework_20261106?replicaSet=rs0&directConnection=true";
execFileSync(process.execPath, ["scripts/seed.js"], {
  env: {
    ...process.env,
    MONGODB_URI: mongoUri,
    SEED_DEMO: "true",
    NODE_ENV: "test",
  },
  stdio: "inherit",
});
await connectDatabase(mongoUri);
const app = createApp({ mongoUri, secret: randomBytes(32).toString("hex") });
const server = app.listen(3012, "127.0.0.1");
const dir = "docs/reports/norde-final";
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(
  dir + "/environment.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      mongodb: (await mongoose.connection.db.admin().serverInfo()).version,
      appCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      carCount: await Car.countDocuments({ archived: false }),
      database: "norde_coursework_20261106",
      endpoint: "http://127.0.0.1:3012/api/cars",
    },
    null,
    2,
  ),
);
const [car, user] = await Promise.all([
  Car.findOne({ status: "available", archived: false }),
  User.findOne({ role: "client" }),
]);
if (!(await Rental.exists({ number: "DOC-0001" }))) {
  await Rental.create({
    number: "DOC-0001",
    user: user._id,
    car: car._id,
    carName: `${car.brand} ${car.model}`,
    from: "2026-11-10",
    to: "2026-11-13",
    extras: { insurance: false, childSeat: false },
    quote: {
      days: 3,
      base: car.dailyRate * 3,
      insurance: 0,
      childSeat: 0,
      total: car.dailyRate * 3,
      deposit: car.deposit,
    },
    status: "cancelled",
    history: [
      { status: "new", at: new Date(), by: user._id },
      { status: "cancelled", at: new Date(), by: user._id },
    ],
  });
}
await fs.writeFile(
  dir + "/database-sample.json",
  JSON.stringify(
    {
      query:
        'db.cars.find({archived:false},{brand:1,model:1,category:1,dailyRate:1,status:1}).sort({dailyRate:1}); db.rentals.find({number:"DOC-0001"}); db.users.find({role:"client"},{name:1,email:1,role:1,ageConfirmed:1,licenseConfirmed:1,drivingExperience:1})',
      cars: await Car.find({ archived: false })
        .select("brand model category dailyRate status")
        .sort({ dailyRate: 1 })
        .lean(),
      rentals: await Rental.find({ number: "DOC-0001" })
        .select("number user car carName from to quote status")
        .lean(),
      users: await User.find({ role: "client" })
        .select(
          "name email role ageConfirmed licenseConfirmed drivingExperience",
        )
        .lean(),
      indexes: {
        cars: await Car.collection.indexes(),
        rentals: await Rental.collection.indexes(),
      },
    },
    null,
    2,
  ),
);
if (process.env.EVIDENCE_LOAD === "true") {
  for (const encoding of ["identity", "gzip"]) {
    const results = [];
    for (const connections of [10, 50]) {
      const r = await autocannon({
        url: "http://127.0.0.1:3012/api/cars",
        connections,
        duration: 5,
        pipelining: 1,
        headers: { "Accept-Encoding": encoding },
      });
      results.push({
        connections,
        duration: r.duration,
        requests: r.requests.total,
        requestsPerSecond: r.requests.average,
        bytesPerSecond: r.throughput.average,
        latencyMeanMs: r.latency.average,
        latencyP50Ms: r.latency.p50,
        latencyP99Ms: r.latency.p99,
        errors: r.errors,
        timeouts: r.timeouts,
        non2xx: r.non2xx,
      });
      console.log("Measured", encoding, connections);
    }
    await fs.writeFile(
      dir + "/load-" + encoding + ".json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          encoding,
          endpoint: "GET /api/cars",
          dataset:
            "12 car documents; same server, only Accept-Encoding differs",
          results,
        },
        null,
        2,
      ),
    );
  }
}
console.log("Evidence server: http://127.0.0.1:3012");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await app.locals.sessionStore.close();
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
