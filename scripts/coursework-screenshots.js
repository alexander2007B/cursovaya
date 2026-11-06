import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const root = "http://127.0.0.1:3012";
async function shot(name) {
  await p.evaluate(async () => {
    const imgs = Array.from(document.images);
    imgs.forEach((i) => (i.loading = "eager"));
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  });
  await p.screenshot({ path: "docs/screenshots/coursework/" + name + ".png" });
}
try {
  await p.goto(root);
  await p.locator(".stage-link").waitFor();
  await p.getByRole("button", { name: "Остановить смену автомобилей" }).click();
  await shot("home");
  await p.goto(root + "/catalog");
  await p.locator(".car-card").first().waitFor();
  await shot("catalog");
  await p
    .getByRole("link", { name: "Выбрать Mercedes-Benz CLS 250 d" })
    .click();
  await p.locator(".booking-panel").waitFor();
  await shot("car");
  await p.getByRole("button", { name: "Войти", exact: true }).click();
  let d = p.getByRole("dialog");
  await d.getByRole("button", { name: "Регистрация", exact: true }).click();
  await shot("registration");
  await d.getByRole("button", { name: "Вход", exact: true }).click();
  await d.getByLabel("Email", { exact: true }).fill("admin@avtobaza.test");
  await d.getByLabel("Пароль", { exact: true }).fill("Avtobaza2026!");
  await d.getByRole("button", { name: "Войти", exact: true }).click();
  await d.waitFor({ state: "hidden" });
  for (const [url, name] of [
    ["/account", "account"],
    ["/admin", "admin"],
    ["/admin?tab=fleet", "fleet"],
    ["/admin?tab=maintenance", "maintenance"],
  ]) {
    await p.goto(root + url);
    await p.waitForLoadState("networkidle");
    await shot(name);
  }
  const transcript = await fs.readFile(
    "docs/reports/norde-final/mongosh.txt",
    "utf8",
  );
  await p.setViewportSize({ width: 1150, height: 1070 });
  await p.setContent(
    '<html lang="ru"><body style="margin:0;background:#101b30;color:#f4f6f9;padding:30px;font:19px/1.45 monospace"><div style="font:14px sans-serif;color:#93bee9;margin-bottom:24px">MongoDB 8 · mongosh · norde_coursework_20261106</div><pre style="white-space:pre-wrap;margin:0"></pre></body></html>',
  );
  await p.locator("pre").evaluate((e, t) => (e.textContent = t), transcript);
  await p.screenshot({
    path: "docs/screenshots/coursework/database.png",
    fullPage: true,
  });
  await fs.writeFile(
    "docs/reports/norde-final/browser-errors.json",
    JSON.stringify(errors, null, 2),
  );
  console.log(
    "Recorded UI and mongosh screenshots; page errors:",
    errors.length,
  );
} finally {
  await b.close();
}
