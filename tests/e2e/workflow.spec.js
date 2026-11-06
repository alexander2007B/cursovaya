import { test, expect } from "@playwright/test";
const login = async (page, email) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Пароль", { exact: true }).fill("Avtobaza2026!");
  await dialog.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(dialog).not.toBeVisible();
};
test("Клиент бронирует, менеджер подтверждает и принимает автомобиль", async ({
  page,
  browser,
}) => {
  await login(page, "client@avtobaza.test");
  await page.goto("/catalog");
  await page.getByRole("link", { name: "Выбрать Kia Rio" }).click();
  await expect(
    page.getByRole("heading", { name: "Kia Rio", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Забронировать", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Вы почти в пути!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мои поездки", exact: true }).click();
  const card = page.locator(".rental-card").first();
  await expect(
    card.locator(".badge").getByText("Новая", { exact: true }),
  ).toBeVisible();
  const number = await card.locator(".rental-car small").innerText();
  const context = await browser.newContext();
  const admin = await context.newPage();
  await login(admin, "manager@avtobaza.test");
  await admin.goto("/admin?tab=rentals");
  const row = admin.getByRole("row").filter({ hasText: number });
  await row.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(row.getByText("Подтверждена", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Выдать авто" }).click();
  await expect(row.getByText("В аренде", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Принять авто" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("button", { name: "Завершить аренду" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row.getByText("Завершена", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".rental-card")
      .filter({ hasText: number })
      .getByText("Завершена", { exact: true })
      .first(),
  ).toBeVisible();
  await context.close();
});
test("Каталог: фильтрация, поиск без результатов, сброс", async ({ page }) => {
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Кроссоверы", exact: true }).click();
  await expect(page.locator(".car-card")).toHaveCount(3);
  await page
    .getByRole("textbox", { name: "Поиск автомобиля" })
    .fill("несуществующая");
  await page.getByRole("button", { name: "Подобрать", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Пока без совпадений" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page.locator(".car-card")).toHaveCount(8);
});
test("Администратор создаёт авто, редактирует и архивирует", async ({
  page,
}) => {
  await login(page, "admin@avtobaza.test");
  await page.goto("/admin?tab=fleet");
  await page.getByRole("button", { name: "Добавить автомобиль" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Марка", { exact: true }).fill("Test");
  await dialog.getByLabel("Модель", { exact: true }).fill("Browser");
  await dialog
    .getByLabel("Госномер", { exact: true })
    .fill("Т" + Date.now().toString().slice(-8));
  await dialog
    .getByLabel("Описание", { exact: true })
    .fill("Тестовый автомобиль браузерной проверки");
  await dialog.getByRole("button", { name: "Сохранить автомобиль" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Изменить Test Browser" }).click();
  await dialog.getByLabel("Стоимость в сутки, ₽").fill("4200");
  await dialog.getByRole("button", { name: "Сохранить автомобиль" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Test Browser" }),
  ).toContainText("4 200".replace(" ", " "));
  await page.getByRole("button", { name: "Архивировать Test Browser" }).click();
  await dialog
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Test Browser" }),
  ).toHaveCount(0);
});
test("Мобильный интерфейс без горизонтальной прокрутки", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/catalog", "/conditions"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Автомобили" }),
  ).toBeVisible();
});
test("Регистрация, изменение профиля и отмена своей заявки", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Регистрация", exact: true })
    .click();
  await dialog.getByLabel("Имя и фамилия").fill("Новый Клиент");
  await dialog.getByLabel("Телефон").fill("+7 900 111-22-33");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill(`browser${Date.now()}@example.test`);
  await dialog.getByLabel("Пароль", { exact: true }).fill("Browserpass2026!");
  await dialog.getByLabel("Стаж вождения, лет").fill("1");
  await dialog.getByLabel("Мне исполнился 21 год").check();
  await dialog.getByLabel("У меня есть действующие водительские права").check();
  await dialog.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/account");
  await page.getByLabel("Имя и фамилия").fill("Обновлённый Клиент");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(
    page.getByRole("heading", { name: "Здравствуйте, Обновлённый." }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Доступ ограничен" }),
  ).toBeVisible();
  await page.goto("/catalog");
  await page.getByRole("link", { name: "Выбрать Hyundai Solaris" }).click();
  await page
    .getByRole("button", { name: "Забронировать", exact: true })
    .click();
  await page.getByRole("button", { name: "Мои поездки", exact: true }).click();
  await page.getByRole("button", { name: "Отменить бронирование" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Да, отменить" })
    .click();
  await expect(page.locator(".rental-card .badge")).toHaveText("Отменена");
  await page.reload();
  await expect(page.locator(".rental-card .badge")).toHaveText("Отменена");
});
