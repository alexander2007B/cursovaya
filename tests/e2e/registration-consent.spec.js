import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../../shared/registration-consent.js";

test("Два флажка, доступные документы и запрет обхода регистрации", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const bypass = await page.evaluate(async () => {
    const { demoApi } = await import("/src/demo-api.js");
    const before = JSON.parse(localStorage.getItem("avtobaza-preview-v1")).users
      .length;
    try {
      await demoApi("/auth/register", {
        method: "POST",
        body: {
          name: "Обход",
          email: "bypass@test.ru",
          password: "Password2026!",
          phone: "+79001234567",
          ageConfirmed: true,
          licenseConfirmed: true,
          drivingExperience: 3,
        },
      });
    } catch (error) {
      return {
        status: error.status,
        before,
        after: JSON.parse(localStorage.getItem("avtobaza-preview-v1")).users
          .length,
      };
    }
  });
  expect(bypass.status).toBe(400);
  expect(bypass.after).toBe(bypass.before);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Регистрация", exact: true })
    .click();
  const terms = dialog.getByRole("checkbox", {
    name: "Я принимаю пользовательское соглашение",
  });
  const consent = dialog.getByRole("checkbox", {
    name: "Я даю согласие на обработку персональных данных",
  });
  const submit = dialog.getByRole("button", { name: "Создать аккаунт" });
  await expect(terms).not.toBeChecked();
  await expect(consent).not.toBeChecked();
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Имя и фамилия").fill("Проверка Согласий");
  await dialog.getByLabel("Телефон").fill("+7 900 111-22-33");
  await dialog.getByLabel("Email", { exact: true }).fill("consented@test.ru");
  await dialog.getByLabel("Пароль", { exact: true }).fill("Testpass2026!");
  await dialog.getByLabel("Стаж вождения, лет").fill("2");
  await dialog.getByLabel("Мне исполнился 21 год").check();
  await dialog.getByLabel("У меня есть действующие водительские права").check();
  for (const [linkName, heading] of [
    [
      "политикой обработки персональных данных",
      "Политика обработки персональных данных",
    ],
    ["пользовательское соглашение", "Пользовательское соглашение"],
    [
      "согласие на обработку персональных данных",
      "Согласие на обработку персональных данных",
    ],
  ]) {
    const popupPromise = context.waitForEvent("page");
    await dialog.getByRole("link", { name: linkName, exact: true }).click();
    const popup = await popupPromise;
    await expect(
      popup.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await popup.close();
  }
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveValue(
    "consented@test.ru",
  );
  await expect(terms).not.toBeChecked();
  await expect(consent).not.toBeChecked();
  await terms.check();
  await expect(submit).toBeDisabled();
  await consent.check();
  await terms.uncheck();
  await expect(submit).toBeDisabled();
  await terms.check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).not.toBeVisible();
  const legal = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("avtobaza-preview-v1")).users.find(
        (u) => u.email === "consented@test.ru",
      ).legal,
  );
  expect(legal.termsVersion).toBe(LEGAL_VERSION);
  expect(legal.consentVersion).toBe(LEGAL_VERSION);
  expect(Number.isNaN(Date.parse(legal.consentAcceptedAt))).toBe(false);
  for (const path of ["/privacy.html", "/terms.html", "/consent.html"]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
  }
});
