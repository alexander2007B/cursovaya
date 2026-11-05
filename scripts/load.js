import autocannon from "autocannon";
import fs from "node:fs/promises";
const results = [];
for (const connections of [10, 50]) {
  const result = await autocannon({
    url: "http://127.0.0.1:3000/api/cars",
    connections,
    duration: 10,
    pipelining: 1,
    headers: { "Accept-Encoding": "gzip" },
  });
  const summary = {
    connections,
    duration: result.duration,
    requests: result.requests.total,
    requestsPerSecond: result.requests.average,
    bytesPerSecond: result.throughput.average,
    latencyMeanMs: result.latency.average,
    latencyP50Ms: result.latency.p50,
    latencyP97_5Ms: result.latency.p97_5,
    latencyP99Ms: result.latency.p99,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
  };
  results.push(summary);
  console.log(summary);
  if (summary.errors || summary.timeouts || summary.non2xx)
    process.exitCode = 1;
}
await fs.mkdir("docs/reports", { recursive: true });
await fs.writeFile(
  "docs/reports/load.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      endpoint: "GET /api/cars",
      dataset:
        "8 active car documents, local MongoDB replica set, unauthenticated catalogue requests",
      results,
    },
    null,
    2,
  ),
);
