import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEGAL_VERSION,
  registrationConsentSchema,
  createConsentRecord,
} from "../shared/registration-consent.js";
const valid = {
  termsAccepted: true,
  personalDataConsent: true,
  legalVersion: LEGAL_VERSION,
};
test("Оба согласия обязательны и не приводятся из строк к true", () => {
  for (const patch of [
    { termsAccepted: false },
    { personalDataConsent: false },
    { termsAccepted: undefined },
    { personalDataConsent: "true" },
    { legalVersion: "old" },
  ])
    assert.equal(
      registrationConsentSchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
  assert.equal(registrationConsentSchema.safeParse(valid).success, true);
});
test("Версии и время фиксируются обработчиком, а не полями запроса", () => {
  const record = createConsentRecord(
    { ...valid, consentAcceptedAt: "1900-01-01" },
    new Date("2026-11-23T10:00:00Z"),
  );
  assert.equal(record.termsVersion, LEGAL_VERSION);
  assert.equal(record.privacyVersion, LEGAL_VERSION);
  assert.equal(record.consentVersion, LEGAL_VERSION);
  assert.equal(record.termsAcceptedAt, "2026-11-23T10:00:00.000Z");
  assert.equal(record.consentAcceptedAt, record.termsAcceptedAt);
});
