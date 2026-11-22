import { test, expect } from "@playwright/test";

async function dragOutside(page, input, dialog) {
  const field = await input.boundingBox();
  const box = await dialog.boundingBox();
  await page.mouse.move(field.x + field.width - 12, field.y + field.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 25, field.y + field.height / 2, { steps: 15 });
  await page.mouse.up();
}

test("Выделение текста и клик по отступу не закрывают вход; фон, Escape и крестик закрывают", async ({ page }) => {
  await page.goto("/");
  const open = page.getByRole("button", { name: "Войти", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Email", { exact: true });
  await input.fill("admin@avtobaza.test");
  await dragOutside(page, input, dialog);
  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue("admin@avtobaza.test");
  let box = await dialog.boundingBox();
  await page.mouse.click(box.x + 4, box.y + 4);
  await expect(dialog).toBeVisible();
  // Starting outside and releasing inside must also preserve the form.
  await page.mouse.move(box.x - 25, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 40, { steps: 10 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await page.mouse.click(box.x - 25, box.y + 40);
  await expect(dialog).not.toBeVisible();
  await open.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await open.click();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("Редактирование автомобиля сохраняет введённое при выделении за пределы окна", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill("admin@avtobaza.test");
  await dialog.getByLabel("Пароль", { exact: true }).fill("Avtobaza2026!");
  await dialog.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/admin?tab=fleet");
  await page.getByRole("button", { name: "Добавить автомобиль", exact: true }).click();
  const input = dialog.getByLabel("Марка", { exact: true });
  await input.fill("Проверка выделения");
  await dragOutside(page, input, dialog);
  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue("Проверка выделения");
});
