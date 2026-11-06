export function eligibilityForm(form) {
  const data = Object.fromEntries(new FormData(form));
  return {
    ...data,
    ageConfirmed: data.ageConfirmed === "on",
    licenseConfirmed: data.licenseConfirmed === "on",
    drivingExperience: Number(data.drivingExperience),
  };
}
export default function EligibilityFields({ user = {} }) {
  return (
    <fieldset className="eligibility-fields">
      <legend>Условия аренды</legend>
      <label className="field">
        <span>Стаж вождения, лет</span>
        <input
          name="drivingExperience"
          type="number"
          min="1"
          max="80"
          step="1"
          required
          defaultValue={user.drivingExperience ?? ""}
          placeholder="От 1 года"
        />
      </label>
      <label className="eligibility-check">
        <input
          type="checkbox"
          name="ageConfirmed"
          required
          defaultChecked={user.ageConfirmed === true}
        />
        <span>Мне исполнился 21 год</span>
      </label>
      <label className="eligibility-check">
        <input
          type="checkbox"
          name="licenseConfirmed"
          required
          defaultChecked={user.licenseConfirmed === true}
        />
        <span>У меня есть действующие водительские права</span>
      </label>
    </fieldset>
  );
}
