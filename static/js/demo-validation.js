export const LEGAL_VERSION = '2026-11-23.1';
export function canRent(b) {
  return b.ageConfirmed === true && b.licenseConfirmed === true && Number.isInteger(b.drivingExperience) && b.drivingExperience >= 1 && b.drivingExperience <= 80;
}
export const eligibilitySchema = {
  parse(b) {
    if (!canRent(b)) throw new Error('Подтвердите возраст, права и стаж от одного года');
    return {
      ageConfirmed: true,
      licenseConfirmed: true,
      drivingExperience: b.drivingExperience
    };
  }
};
export const registrationConsentSchema = {
  safeParse(b) {
    return b.termsAccepted === true && b.personalDataConsent === true && b.legalVersion === LEGAL_VERSION ? {
      success: true,
      data: b
    } : {
      success: false,
      error: {
        issues: [{
          message: 'Примите соглашение и дайте отдельное согласие на обработку данных'
        }]
      }
    };
  }
};
export function createConsentRecord(b) {
  if (!registrationConsentSchema.safeParse(b).success) throw new Error('Необходимо согласие');
  const at = new Date().toISOString();
  return {
    termsVersion: LEGAL_VERSION,
    termsAcceptedAt: at,
    privacyVersion: LEGAL_VERSION,
    consentVersion: LEGAL_VERSION,
    consentAcceptedAt: at
  };
}
