import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("avtobaza-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("avtobaza-theme", theme);
    } catch {}
  }, [theme]);
  return (
    <button
      className="icon-button theme-toggle"
      aria-label={
        theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"
      }
      title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
