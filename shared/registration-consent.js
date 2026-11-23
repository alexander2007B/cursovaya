import { z } from "zod";
export const LEGAL_VERSION = "2026-11-23.1";
export const registrationConsentFields = {
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "Примите пользовательское соглашение" }),
  }),
  personalDataConsent: z.literal(true, {
    errorMap: () => ({
      message: "Дайте согласие на обработку персональных данных",
    }),
  }),
  legalVersion: z.literal(LEGAL_VERSION, {
    errorMap: () => ({
      message:
        "Документы обновились. Обновите страницу и ознакомьтесь с ними повторно",
    }),
  }),
};
export const registrationConsentSchema = z.object(registrationConsentFields);
export function createConsentRecord(input, now = new Date()) {
  registrationConsentSchema.parse(input);
  return {
    termsVersion: LEGAL_VERSION,
    termsAcceptedAt: now.toISOString(),
    privacyVersion: LEGAL_VERSION,
    consentVersion: LEGAL_VERSION,
    consentAcceptedAt: now.toISOString(),
  };
}
