import { z } from "zod";
export const eligibilityFields = {
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Подтвердите, что вам исполнился 21 год" }),
  }),
  licenseConfirmed: z.literal(true, {
    errorMap: () => ({
      message: "Подтвердите наличие действующих водительских прав",
    }),
  }),
  drivingExperience: z
    .number()
    .int()
    .min(1, "Минимальный стаж — 1 год")
    .max(80),
};
export const eligibilitySchema = z.object(eligibilityFields);
export const canRent = (user) => eligibilitySchema.safeParse(user).success;
