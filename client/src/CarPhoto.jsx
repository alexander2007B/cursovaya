import { useState } from "react";
import { api } from "./api";
import "./car-photos.css";
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
export function PhotoField({
  defaultValue = "/images/sedan.svg",
  defaultGallery = [],
}) {
  const [photos, setPhotos] = useState(() =>
    [defaultValue, ...defaultGallery].filter(
      (src, index, all) =>
        src && src !== "/images/sedan.svg" && all.indexOf(src) === index,
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(e) {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length || busy) return;
    setError("");
    setBusy(true);
    try {
      if (photos.length + files.length > 4)
        throw new Error(
          "Можно добавить до 4 фотографий. Удалите лишнюю или выберите меньше файлов.",
        );
      for (const file of files) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 4 * 1024 * 1024
        )
          throw new Error("Выберите JPG, PNG или WebP до 4 МБ каждый");
      }
      for (const file of files) {
        const bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 20000000) {
          bitmap.close();
          throw new Error("Максимум 20 мегапикселей на фотографию");
        }
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1400 / bitmap.width, 1000 / bitmap.height);
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas
          .getContext("2d")
          .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const result = await api("/admin/photos", {
          method: "POST",
          body: { data: canvas.toDataURL("image/webp", 0.82) },
        });
        setPhotos((current) => [...current, result.image]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  return (
    <div className="photo-field">
      <input
        type="hidden"
        name="image"
        value={photos[0] || "/images/sedan.svg"}
      />
      <input
        type="hidden"
        name="gallery"
        value={JSON.stringify(photos.slice(1))}
      />
      <div className="photo-previews">
        {photos.map((src, index) => (
          <div className="photo-preview" key={`${index}-${src}`}>
            <CarImage src={src} alt={`Фото ${index + 1} автомобиля`} />
            <span>{index === 0 ? "Главная" : `Фото ${index + 1}`}</span>
            <div className="photo-preview-actions">
              {index > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setPhotos((current) => [
                      current[index],
                      ...current.filter((_, i) => i !== index),
                    ])
                  }
                >
                  Сделать главной
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                aria-label={`Удалить фото ${index + 1}`}
                onClick={() =>
                  setPhotos((current) => current.filter((_, i) => i !== index))
                }
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        {!photos.length && (
          <CarImage
            src="/images/sedan.svg"
            alt="Добавьте фотографии автомобиля"
          />
        )}
      </div>
      <label className="photo-upload">
        <span>
          {busy
            ? "Обрабатываем фотографии…"
            : `Добавить фотографии (${photos.length}/4)`}
        </span>
        <input
          aria-label="Фотографии автомобиля"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || photos.length >= 4}
          onChange={upload}
        />
      </label>
      <small>
        До 4 фото: JPG, PNG, WebP до 4 МБ каждое. Первое фото будет обложкой.
      </small>
      {busy && (
        <input
          className="upload-guard"
          required
          value=""
          onChange={() => {}}
          aria-label="Дождитесь загрузки фотографий"
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
