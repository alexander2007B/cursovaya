import { test } from "node:test";
import assert from "node:assert/strict";
import { fleet } from "../shared/fleet.js";
import { selectHomeOffers } from "../client/src/home-offers.js";

test("На главной только шесть выбранных моделей в заданном порядке", () => {
  const cars = [...fleet].reverse();
  const before = structuredClone(cars);
  assert.deepEqual(
    selectHomeOffers(cars).map((c) => c.model),
    ["GLB 200", "Cityray", "A5", "520d xDrive", "M4 Competition", "CLS 250 d"],
  );
  assert.deepEqual(cars, before);
});

test("Занятые и архивные предложения не подменяются другими моделями", () => {
  const cars = fleet.map((car) => ({ ...car }));
  cars.find((c) => c.model === "GLB 200").archived = true;
  cars.find((c) => c.model === "Cityray").status = "maintenance";
  cars.find((c) => c.model === "A5").displayStatus = "rented";
  assert.deepEqual(
    selectHomeOffers(cars).map((c) => c.model),
    ["520d xDrive", "M4 Competition", "CLS 250 d"],
  );
  assert.deepEqual(selectHomeOffers([]), []);
});
