import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateQuote, validateTransition } from "../server/domain.js";

test("Стоимость: сутки, дополнительные услуги и отдельный залог", () => {
  assert.deepEqual(
    calculateQuote(
      { dailyRate: 4000, deposit: 20000 },
      "2027-02-01",
      "2027-02-04",
      { insurance: true, childSeat: true },
      "2027-01-01",
    ),
    {
      days: 3,
      dailyRate: 4000,
      base: 12000,
      insurance: 1800,
      childSeat: 900,
      total: 14700,
      deposit: 20000,
    },
  );
});
test("Неделя аренды даёт скидку 10% на базовую стоимость", () => {
  assert.equal(
    calculateQuote(
      { dailyRate: 4000, deposit: 20000 },
      "2027-02-01",
      "2027-02-08",
      {},
      "2027-01-01",
    ).total,
    25200,
  );
});
test("Даты проверяются строго, включая невозможные и прошедшие", () => {
  for (const [from, to] of [
    ["2027-02-30", "2027-03-03"],
    ["2027-02-01", "2027-02-01"],
    ["2026-12-01", "2026-12-02"],
    ["2027-02-01", "2027-05-01"],
  ]) {
    assert.throws(() =>
      calculateQuote(
        { dailyRate: 4000, deposit: 20000 },
        from,
        to,
        {},
        "2027-01-01",
      ),
    );
  }
});
test("Статусы аренды изменяются только по разрешённым переходам", () => {
  assert.doesNotThrow(() => validateTransition("new", "confirmed", "manager"));
  assert.doesNotThrow(() => validateTransition("new", "cancelled", "client"));
  assert.throws(() => validateTransition("new", "completed", "admin"));
  assert.throws(() => validateTransition("confirmed", "active", "client"));
  assert.throws(() => validateTransition("completed", "active", "admin"));
});
