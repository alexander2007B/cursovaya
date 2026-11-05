import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRussianPhone, displayRussianPhone } from "../shared/phone.js";
test("Номер РФ: +7, префикс 8 и 10 цифр приводятся к одному виду", () => {
  for (const value of ["+7 (900)-123-45-67", "8 (900) 123-45-67", "9001234567"])
    assert.equal(normalizeRussianPhone(value), "+79001234567");
  assert.equal(displayRussianPhone("+79001234567"), "+7 (900)-123-45-67");
});
test("Неполный, слишком длинный, иностранный номер и буквы отклоняются", () => {
  for (const value of [
    "+7 (900)-123",
    "+790012345678",
    "+12025550123",
    "8aaa9001234567",
    "()()()()()",
  ])
    assert.throws(() => normalizeRussianPhone(value));
});
