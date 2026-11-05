import { useState } from "react";
import { api } from "./api";
export function CarImage({ src, alt = "", ...props }) {
  return (
    <img
      {...props}
      src={src || "/images/sedan.svg"}
      alt={alt}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith("/images/sedan.svg"))
          e.currentTarget.src = "/images/sedan.svg";
      }}
    />
  );
}
export function PhotoField({ defaultValue = "/images/sedan.svg" }) {
  const [value, setValue] = useState(defaultValue),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 4 * 1024 * 1024
      )
        throw new Error("Выберите JPG, PNG или WebP до 4 МБ");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 20000000) {
        bitmap.close();
        throw new Error("Максимум 20 мегапикселей");
      }
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1400 / bitmap.width, 1000 / bitmap.height);
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const data = canvas.toDataURL("image/webp", 0.82);
      const result = await api("/admin/photos", {
        method: "POST",
        body: { data },
      });
      setValue(result.image);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <div className="photo-field">
      <input type="hidden" name="image" value={value} />
      <CarImage src={value} alt="Предпросмотр фотографии автомобиля" />
      <label className="photo-upload">
        <span>{busy ? "Обрабатываем фото…" : "Загрузить фотографию"}</span>
        <input
          aria-label="Фотография автомобиля"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={upload}
        />
      </label>
      <small>
        JPG, PNG, WebP · до 4 МБ. Используйте фото с разрешением владельца.
      </small>
      {busy && (
        <input
          className="upload-guard"
          required
          value=""
          onChange={() => {}}
          aria-label="Дождитесь загрузки фотографии"
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
