import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fs.mkdir("docs/screenshots/motion", { recursive: true });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator('img[src*="hero-road"]')).toHaveCount(0);
  await page.getByRole("link", { name: "За город", exact: true }).click();
  await expect(page).toHaveURL(/category=suv/);
  await expect(page.locator(".car-card:not(.suv)")).toHaveCount(0);
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "docs/screenshots/motion/dark.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5173/catalog");
  await page.getByRole("link", { name: "Выбрать Solaris KRS Comfort" }).click();
  const carUrl = page.url();
  await page
    .getByRole("button", { name: "Забронировать", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Создать аккаунт" }),
  ).toBeVisible();
  await dialog.getByLabel("Имя и фамилия").fill("Проверка Условий");
  await dialog.getByLabel("Телефон").fill("+7 (900)-123-45-67");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("theme-test@example.test");
  await dialog.getByLabel("Пароль", { exact: true }).fill("Testpass2026!");
  await dialog.getByLabel("Стаж вождения, лет").fill("0");
  await dialog.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Стаж вождения, лет").fill("1");
  await dialog.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Мне исполнился 21 год").check();
  await dialog.getByLabel("У меня есть действующие водительские права").check();
  await page.screenshot({ path: "docs/screenshots/motion/registration.png" });
  await dialog.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(carUrl);
  await page
    .getByRole("button", { name: "Забронировать", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Мои поездки", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мои поездки", exact: true }).click();
  await expect(page.getByLabel("Стаж вождения, лет")).toHaveValue("1");
  await page.evaluate(async () => {
    const { demoApi } = await import("/src/demo-api.js");
    await demoApi("/auth/login", {
      method: "POST",
      body: { email: "admin@avtobaza.test", password: "Avtobaza2026!" },
    });
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"]) {
      await page.goto("http://127.0.0.1:5173");
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", {
            name:
              theme === "dark"
                ? "Включить тёмную тему"
                : "Включить светлую тему",
          })
          .click();
      for (const route of [
        "/",
        "/catalog",
        "/account",
        "/admin",
        "/conditions",
      ]) {
        await page.goto("http://127.0.0.1:5173" + route);
        await page.evaluate(async () => {
          const images = Array.from(document.images);
          images.forEach((img) => (img.loading = "eager"));
          await Promise.all(images.map((img) => img.decode().catch(() => {})));
        });
        await page.waitForLoadState("networkidle");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        if (route === "/" || route === "/admin" || route === "/catalog")
          await page.screenshot({
            path: `docs/screenshots/motion/${theme}-${width}-${route === "/admin" ? "admin" : route === "/catalog" ? "catalog" : "home"}.png`,
            fullPage: true,
          });
      }
    }
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS: theme persistence, required eligibility, guest registration preserves car, booking, profile, desktop/mobile both themes",
  );
} finally {
  await browser.close();
}
