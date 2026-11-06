try {
  document.documentElement.dataset.theme =
    localStorage.getItem("avtobaza-theme") === "dark" ? "dark" : "light";
} catch {}
