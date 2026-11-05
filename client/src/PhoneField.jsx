import { useState } from "react";
import { IMaskInput } from "react-imask";
import { displayRussianPhone } from "../../shared/phone.js";
export default function PhoneField({ defaultValue = "" }) {
  const [value, setValue] = useState(displayRussianPhone(defaultValue));
  return (
    <label className="field">
      <span>Телефон</span>
      <IMaskInput
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        mask="+{7} (000)-000-00-00"
        value={value}
        onAccept={setValue}
        placeholder="+7 (___)-___-__-__"
        pattern="[+]7 [(][0-9]{3}[)]-[0-9]{3}-[0-9]{2}-[0-9]{2}"
        onPaste={(e) => {
          const normalized = displayRussianPhone(
            e.clipboardData.getData("text"),
          );
          if (normalized) {
            e.preventDefault();
            setValue(normalized);
          }
        }}
      />
      <small className="field-hint">Российский номер · +7 и 10 цифр</small>
    </label>
  );
}
