import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.setDefaultTimeout(15000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await fs.mkdir("docs/screenshots/full-catalog", { recursive: true });
  await p.addInitScript(() => localStorage.setItem("avtobaza-theme", "dark"));
  await p.goto("http://127.0.0.1:5173/catalog");
  await expect(p.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(p.getByRole("button", { name: /Включить.*тему/ })).toHaveCount(
    0,
  );
  await expect(p.locator(".car-card")).toHaveCount(12);
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("avtobaza-preview-v1"));
    d.cars[0].brand = "Kia";
    d.cars[0].model = "Rio";
    d.cars[0].image = "/images/compact.svg";
    d.cars[0].mileage = 99999;
    d.cars[1].image = "/images/cls.jpg";
    delete d.fleetPhotosEdition;
    d.events.push({
      _id: "preserved-event",
      action: "Сохранённое событие",
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("avtobaza-preview-v1", JSON.stringify(d));
    sessionStorage.setItem("check-car-id", d.cars[0]._id);
  });
  await p.reload();
  await expect(p.locator(".car-card")).toHaveCount(12);
  expect(
    await p.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("avtobaza-preview-v1"));
      return [
        d.cars[0]._id === sessionStorage.getItem("check-car-id"),
        d.cars[0].model,
        d.cars[0].mileage,
        d.cars[1].image,
        d.events.some((e) => e._id === "preserved-event"),
      ];
    }),
  ).toEqual([true, "KRS Comfort", 99999, "/images/cls.jpg", true]);
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("avtobaza-preview-v1"));
    d.cars[1].image = "/images/jaecoo-j6.jpg";
    localStorage.setItem("avtobaza-preview-v1", JSON.stringify(d));
  });
  await p.reload();
  await expect(p.locator(".car-card")).toHaveCount(12);
  await expect(p.locator('.car-visual img[src$=".svg"]')).toHaveCount(0);
  await p.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll(".car-visual img"));
    imgs.forEach((i) => (i.loading = "eager"));
    await Promise.all(imgs.map((i) => i.decode()));
    if (imgs.some((i) => !i.naturalWidth)) throw new Error("Broken photo");
  });
  const footer = p.locator("footer");
  await expect(footer.getByText("Баев Александр Павлович")).toBeVisible();
  await expect(footer.locator('a[href="tel:+79218287767"]')).toHaveText(
    "+7 (921)-828-77-67",
  );
  await expect(
    footer.locator('a[href="mailto:viperr@angel.com"]').last(),
  ).toHaveText("viperr@angel.com");
  await expect(
    footer.getByText("Вологда, ул. Первомайская, 42", { exact: false }),
  ).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await p.setViewportSize({ width, height: 1000 });
    for (const theme of ["light"]) {
      if ((await p.locator("html").getAttribute("data-theme")) !== theme)
        await p
          .getByRole("button", {
            name:
              theme === "light"
                ? "Включить светлую тему"
                : "Включить тёмную тему",
          })
          .click();
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await footer.screenshot({
        path: `docs/screenshots/full-catalog/footer-${theme}-${width}.png`,
      });
      if (width !== 320)
        await p.screenshot({
          path: `docs/screenshots/full-catalog/catalog-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await footer.getByRole("button", { name: "Наверх" }).click();
  await expect.poll(() => p.evaluate(() => scrollY)).toBeLessThan(10);
  expect(errors).toEqual([]);
  console.log(
    "PASS: all 12 photos decode, legacy photo migration preserves IDs/mileage/events/custom photo, footer contacts/map, back to top and 320/390/1440px light theme, including saved legacy dark preference; no browser errors",
  );
} finally {
  await browser.close();
}
