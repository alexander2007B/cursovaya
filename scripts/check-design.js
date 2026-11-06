import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.waitForLoadState("networkidle");
await page.screenshot({
  path: "docs/screenshots/glass/home.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Войти", exact: true }).click();
let dialog = page.getByRole("dialog");
await dialog.getByRole("button", { name: "Регистрация", exact: true }).click();
const phone = dialog.getByLabel("Телефон");
await phone.fill("+7 (900)-123-45-67");
assert.equal(await phone.inputValue(), "+7 (900)-123-45-67");
await phone.press("End");
await phone.press("Backspace");
assert.equal(await phone.inputValue(), "+7 (900)-123-45-6");
await phone.press("7");
assert.equal(await phone.inputValue(), "+7 (900)-123-45-67");
await phone.evaluate((el) => {
  const data = new DataTransfer();
  data.setData("text/plain", "8 (921) 555-44-33");
  el.dispatchEvent(
    new ClipboardEvent("paste", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    }),
  );
});
assert.equal(await phone.inputValue(), "+7 (921)-555-44-33");
await dialog.getByLabel("Имя и фамилия").fill("Тест Вологда");
await dialog.getByLabel("Email", { exact: true }).fill("design@example.test");
await dialog.getByLabel("Пароль", { exact: true }).fill("Testpass2026!");
await dialog.getByLabel("Стаж вождения, лет").fill("1");
await dialog.getByLabel("Мне исполнился 21 год").check();
await dialog.getByLabel("У меня есть действующие водительские права").check();
await dialog.getByRole("button", { name: "Создать аккаунт" }).click();
await dialog.waitFor({ state: "hidden" });
await page.evaluate(async () => {
  const { demoApi: api } = await import("/src/demo-api.js");
  await api("/auth/login", {
    method: "POST",
    body: { email: "admin@avtobaza.test", password: "Avtobaza2026!" },
  });
});
await page.goto("http://127.0.0.1:5173/admin?tab=fleet");
await page.getByRole("button", { name: "Изменить Solaris KRS Comfort" }).click();
dialog = page.getByRole("dialog");
await dialog
  .getByLabel("Фотография автомобиля")
  .setInputFiles("tests/fixtures/upload-car.jpg");
await page.waitForFunction(() =>
  document
    .querySelector("input[name=image]")
    ?.value.startsWith("data:image/webp"),
);
await dialog.getByRole("button", { name: "Сохранить автомобиль" }).click();
await dialog.waitFor({ state: "hidden" });
await page.reload();
await page.getByRole("button", { name: "Изменить Solaris KRS Comfort" }).click();
assert.match(
  await page.locator("input[name=image]").inputValue(),
  /^data:image\/webp/,
);
await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
await page.screenshot({
  path: "/tmp/avtobaza-admin-upload-test.png",
  fullPage: true,
});
await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("avtobaza-preview-v1"));
  db.cars.find((c) => c.brand === "Solaris" && c.model === "KRS Comfort").image =
    "/images/sedan.svg";
  localStorage.setItem("avtobaza-preview-v1", JSON.stringify(db));
});
await page.goto("http://127.0.0.1:5173/catalog");
await page.waitForLoadState("networkidle");
await page.screenshot({
  path: "docs/screenshots/glass/catalog.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
for (const route of ["/", "/catalog", "/account", "/admin"]) {
  await page.goto("http://127.0.0.1:5173" + route);
  await page.waitForLoadState("networkidle");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    route + " overflow",
  );
  if (route === "/")
    await page.screenshot({
      path: "docs/screenshots/glass/mobile.png",
      fullPage: true,
    });
}
assert.deepEqual(errors, []);
console.log(
  "PASS: mask typing/backspace/paste, registration, photo upload/persistence, desktop/mobile layouts; zero page errors",
);
await browser.close();
