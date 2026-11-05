import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "node scripts/e2e-server.js",
    url: "http://127.0.0.1:3001/api/health",
    timeout: 30000,
    reuseExistingServer: false,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
          args: ["--no-sandbox"],
        }
      : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
