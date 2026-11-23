import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("Четыре фото сохраняются, открываются в галерее и редактируются", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill("admin@avtobaza.test");
  await dialog.getByLabel("Пароль", { exact: true }).fill("Avtobaza2026!");
  await dialog.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/admin?tab=fleet");
  await page
    .getByRole("button", { name: "Добавить автомобиль", exact: true })
    .click();
  const files = await Promise.all(
    ["red", "blue", "green", "yellow", "purple"].map(async (background, i) => ({
      name: `car-${i}.jpg`,
      mimeType: "image/jpeg",
      buffer: await sharp({
        create: { width: 100, height: 80, channels: 3, background },
      })
        .jpeg()
        .toBuffer(),
    })),
  );
  const upload = dialog.getByLabel("Фотографии автомобиля", { exact: true });
  await upload.setInputFiles(files);
  await expect(dialog.getByRole("alert")).toContainText("до 4 фотографий");
  await upload.setInputFiles(files.slice(0, 4));
  await expect(
    dialog.getByRole("img", { name: /Фото \d автомобиля/ }),
  ).toHaveCount(4);
  await expect(upload).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Сделать главной", exact: true })
    .nth(1)
    .click();
  await dialog.getByLabel("Марка", { exact: true }).fill("Test");
  await dialog.getByLabel("Модель", { exact: true }).fill("Gallery");
  await dialog.getByLabel("Госномер", { exact: true }).fill("Т999ТТ35");
  await dialog
    .getByLabel("Описание", { exact: true })
    .fill("Автомобиль с четырьмя фотографиями");
  await dialog.getByRole("button", { name: "Сохранить автомобиль" }).click();
  await expect(dialog).not.toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("avtobaza-preview-v1")).cars.find(
      (c) => c.plate === "Т999ТТ35",
    ),
  );
  expect(saved.gallery).toHaveLength(3);
  expect(new Set([saved.image, ...saved.gallery]).size).toBe(4);
  await page.goto(`/cars/${saved._id}`);
  await expect(
    page.getByRole("button", { name: /Показать фото \d/ }),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Показать фото 4", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Показать фото 4", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/admin?tab=fleet");
  const row = page.getByRole("row").filter({ hasText: "Т999ТТ35" });
  await row.getByRole("button", { name: /Изменить/ }).click();
  await expect(
    dialog.getByRole("img", { name: /Фото \d автомобиля/ }),
  ).toHaveCount(4);
  await dialog
    .getByRole("button", { name: "Удалить фото 2", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Сохранить автомобиль" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("avtobaza-preview-v1")).cars.find(
          (c) => c.plate === "Т999ТТ35",
        ).gallery.length,
    ),
  ).toBe(2);
});
