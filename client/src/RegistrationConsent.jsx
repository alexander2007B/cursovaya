import { LEGAL_VERSION } from "../../shared/registration-consent.js";
import "./registration-consent.css";
export default function RegistrationConsent({ value, onChange }) {
  return (
    <fieldset className="registration-consent">
      <legend>Документы и согласия</legend>
      <p>
        Перед регистрацией ознакомьтесь с{" "}
        <a
          href={`/legal/${LEGAL_VERSION}/privacy.html`}
          target="_blank"
          rel="noopener noreferrer"
        >
          политикой обработки персональных данных
        </a>
        .
      </p>
      <label>
        <input
          name="termsAccepted"
          type="checkbox"
          required
          checked={value.termsAccepted}
          onChange={(e) =>
            onChange({ ...value, termsAccepted: e.target.checked })
          }
        />
        <span>
          Я принимаю{" "}
          <a
            href={`/legal/${LEGAL_VERSION}/terms.html`}
            target="_blank"
            rel="noopener noreferrer"
          >
            пользовательское соглашение
          </a>
        </span>
      </label>
      <label>
        <input
          name="personalDataConsent"
          type="checkbox"
          required
          checked={value.personalDataConsent}
          onChange={(e) =>
            onChange({ ...value, personalDataConsent: e.target.checked })
          }
        />
        <span>
          Я даю{" "}
          <a
            href={`/legal/${LEGAL_VERSION}/consent.html`}
            target="_blank"
            rel="noopener noreferrer"
          >
            согласие на обработку персональных данных
          </a>
        </span>
      </label>
    </fieldset>
  );
}
