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
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fs.mkdir("docs/screenshots/rental", { recursive: true });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator(".stage-information h2")).toBeVisible();
  // Existing demo users and history survive the fleet update.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("avtobaza-preview-v1"));
    d.cars = d.cars.slice(0, 8);
    delete d.fleetEdition;
    d.users[2].name = "Сохранённый Клиент";
    d.events.push({
      _id: "migration-check",
      action: "Сохранённое событие",
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("avtobaza-preview-v1", JSON.stringify(d));
  });
  await page.reload();
  await expect(page.locator(".stage-information h2")).toBeVisible();
  expect(
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("avtobaza-preview-v1"));
      return [
        d.cars.length,
        d.users[2].name,
        d.events.some((e) => e._id === "migration-check"),
      ];
    }),
  ).toEqual([12, "Сохранённый Клиент", true]);
  const first = await page.locator(".stage-information h2").textContent();
  await expect(page.locator(".stage-information h2")).not.toHaveText(first, {
    timeout: 4000,
  });
  await page
    .getByRole("button", { name: "Остановить смену автомобилей" })
    .click();
  const paused = await page.locator(".stage-information h2").textContent();
  await page.waitForTimeout(2250);
  await expect(page.locator(".stage-information h2")).toHaveText(paused);
  await page.getByRole("button", { name: "Следующий автомобиль" }).click();
  await expect(page.locator(".stage-information h2")).not.toHaveText(paused);
  // Favorite state is shared by the hero, header and catalog and persists on reload.
  await page.locator(".stage-top .favorite-toggle").click();
  await page.getByRole("link", { name: "Избранное: 1" }).click();
  await expect(page.locator(".car-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".car-card")).toHaveCount(1);
  // Quick search works from the floating header.
  await page
    .getByRole("button", { name: "Найти автомобиль", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Марка или модель").fill("Mercedes");
  await dialog.getByRole("button", { name: "Найти автомобиль" }).click();
  await expect(page.locator(".car-card")).toHaveCount(1);
  await expect(page.locator(".car-card")).toContainText("CLS");
  await page
    .getByRole("link", { name: "Выбрать Mercedes-Benz CLS 250 d" })
    .click();
  await page.getByRole("button", { name: "Показать фото 2" }).click();
  await expect(page.locator(".detail-visual img")).toHaveAttribute(
    "src",
    "/images/cls-0.jpg",
  );
  // A booked car is removed from the carousel for the same dates.
  await page.evaluate(async () => {
    const { demoApi } = await import("/src/demo-api.js");
    await demoApi("/auth/login", {
      method: "POST",
      body: { email: "client@avtobaza.test", password: "Avtobaza2026!" },
    });
  });
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator(".stage-link")).toBeVisible();
  await page
    .getByRole("button", { name: "Остановить смену автомобилей" })
    .click();
  const href = await page.locator(".stage-link").getAttribute("href");
  const url = new URL(href, "http://demo");
  const booked = url.pathname.split("/").pop();
  const dates = Object.fromEntries(url.searchParams);
  await page.evaluate(
    async ({ booked, dates }) => {
      const { demoApi } = await import("/src/demo-api.js");
      await demoApi("/rentals", {
        method: "POST",
        body: {
          carId: booked,
          ...dates,
          extras: { insurance: false, childSeat: false },
        },
      });
    },
    { booked, dates },
  );
  await page.reload();
  await expect(page.locator(".stage-link")).toBeVisible();
  for (let i = 0; i < 4; i++) {
    expect(
      await page.locator(".stage-link").getAttribute("href"),
    ).not.toContain(booked);
    await page.getByRole("button", { name: "Следующий автомобиль" }).click();
  }
  // Date validity and practical category shortcuts.
  await page.getByLabel("Возврат", { exact: true }).fill(dates.from);
  await expect(
    page.getByRole("button", { name: "Найти машину", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Возврат", { exact: true }).fill(dates.to);
  await expect(page.locator(".stage-link")).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
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
      await expect(page.locator(".stage-link")).toBeVisible();
      await page
        .getByRole("button", { name: "Остановить смену автомобилей" })
        .click();
      await page.evaluate(async () => {
        const imgs = Array.from(document.images);
        imgs.forEach((i) => (i.loading = "eager"));
        await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `docs/screenshots/rental/${theme}-${width}-home.png`,
        fullPage: true,
      });
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      expect(
        await page
          .locator("header")
          .evaluate((e) => e.getBoundingClientRect().top),
      ).toBeLessThanOrEqual(14);
      expect(
        await page
          .locator("header")
          .evaluate((e) => getComputedStyle(e).backdropFilter),
      ).toContain("blur");
      await page.screenshot({
        path: `docs/screenshots/rental/${theme}-${width}-sticky.png`,
      });
      await page.getByRole("link", { name: /Избранное:/ }).click();
      await expect(page.locator(".car-card")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS: non-destructive demo migration, 2-second carousel, pause/manual controls, date availability, favorites persistence, search, gallery, sticky glass header, 320/390/1440px both themes; zero browser errors",
  );
} finally {
  await browser.close();
}
