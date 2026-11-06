import { useEffect, useState } from "react";
const KEY = "norde-favorites";
function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
export default function useFavorites() {
  const [favorites, setFavorites] = useState(read);
  useEffect(() => {
    const sync = (e) => {
      if (e.key === KEY) setFavorites(read());
    };
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);
  function toggleFavorite(id) {
    setFavorites((list) => {
      const next = list.includes(id)
        ? list.filter((v) => v !== id)
        : [...list, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return { favorites, toggleFavorite };
}
