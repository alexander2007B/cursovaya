import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fleet, legacyFleet, photoUpgrade } from "../shared/fleet.js";
test("У всех 12 стандартных автомобилей есть локальные фотографии", () => {
  assert.equal(fleet.length, 12);
  for (const car of fleet) {
    assert.match(car.image, /\.jpg$/);
    assert.ok(
      existsSync(new URL("../client/public" + car.image, import.meta.url)),
    );
  }
});
test("Обновление старой иллюстрации сохраняет идентификатор, пробег и статус", () => {
  const old = {
    ...legacyFleet[0],
    _id: "saved-id",
    mileage: 99999,
    status: "maintenance",
    image: "/images/compact.svg",
  };
  const upgraded = { ...old, ...photoUpgrade(old) };
  assert.equal(upgraded._id, old._id);
  assert.equal(upgraded.mileage, 99999);
  assert.equal(upgraded.status, "maintenance");
  assert.match(upgraded.image, /\.jpg$/);
});
test("Пользовательские фото и изменённые модели не перезаписываются", () => {
  assert.equal(
    photoUpgrade({ ...legacyFleet[0], image: "/uploads/custom.webp" }),
    null,
  );
  assert.equal(
    photoUpgrade({
      ...legacyFleet[0],
      brand: "Custom",
      image: "/images/compact.svg",
    }),
    null,
  );
});
