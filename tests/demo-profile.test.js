import { test } from "node:test";
import assert from "node:assert/strict";
import { demoApi } from "../client/src/demo-api.js";

test("Демопрофиль обновляется с сохранением заявок и пользовательского имени", async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.sessionStorage = { getItem: () => "manager-id" };
  const key = "avtobaza-preview-v1";
  await demoApi("/auth/session");
  const db = JSON.parse(storage.get(key));
  const manager = db.users.find((u) => u.email === "manager@avtobaza.test");
  assert.equal(manager.name, "Дмитрий");
  manager.id = "manager-id";
  manager.name = "Анна Миронова";
  db.rentals = [{ _id: "saved-rental", user: manager.id, status: "new" }];
  storage.set(key, JSON.stringify(db));
  assert.equal((await demoApi("/auth/session")).user.name, "Дмитрий");
  const updated = JSON.parse(storage.get(key));
  const expected = structuredClone(db);
  expected.users.find((u) => u.id === manager.id).name = "Дмитрий";
  assert.deepEqual(updated, expected);
  updated.users.find((u) => u.id === manager.id).name = "Моё имя";
  storage.set(key, JSON.stringify(updated));
  assert.equal((await demoApi("/auth/session")).user.name, "Моё имя");
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});
