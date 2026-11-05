import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("docs/screenshots", { recursive: true });
for (const [route, name] of [
  ["/", "home"],
  ["/catalog", "catalog"],
]) {
  await page.goto("http://127.0.0.1:3000" + route);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: false,
  });
}
await page.locator(".car-card").first().locator("a").first().click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "docs/screenshots/car.png", fullPage: false });
await page.getByRole("button", { name: "Войти", exact: true }).click();
const dialog = page.getByRole("dialog");
await dialog.getByLabel("Email", { exact: true }).fill("admin@avtobaza.test");
await dialog.getByLabel("Пароль", { exact: true }).fill("Avtobaza2026!");
await dialog.getByRole("button", { name: "Войти", exact: true }).click();
await dialog.waitFor({ state: "hidden" });
for (const [route, name] of [
  ["/admin", "admin"],
  ["/admin?tab=fleet", "fleet"],
  ["/admin?tab=maintenance", "maintenance"],
]) {
  await page.goto("http://127.0.0.1:3000" + route);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: false,
  });
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:3000/");
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "docs/screenshots/mobile.png", fullPage: false });
await fs.writeFile(
  "docs/reports/browser-errors.json",
  JSON.stringify(errors, null, 2),
);
console.log("Browser errors:", errors.length);
await browser.close();
