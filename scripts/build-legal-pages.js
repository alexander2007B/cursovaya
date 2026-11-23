import { mkdir, writeFile, readFile } from "node:fs/promises";
import { LEGAL_VERSION } from "../shared/registration-consent.js";
import { legalDocuments } from "../shared/legal-documents.js";
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const root = new URL("../client/public/", import.meta.url);
const archive = new URL(`legal/${LEGAL_VERSION}/`, root);
await mkdir(archive, { recursive: true });
for (const [name, document] of Object.entries(legalDocuments)) {
  const body = document.sections
    .map(
      ([heading, paragraphs]) =>
        `<section><h2>${escape(heading)}</h2>${paragraphs.map((text) => `<p>${escape(text)}</p>`).join("")}</section>`,
    )
    .join("");
  const html = `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(document.title)} | NORDÉ</title><link rel="stylesheet" href="/legal.css"></head><body><header><a href="/" aria-label="NORDÉ — главная">NORDÉ</a><nav aria-label="Юридические документы"><a href="/privacy.html">Политика</a><a href="/terms.html">Соглашение</a><a href="/consent.html">Согласие</a></nav></header><main><p class="version">Редакция 23.11.2026 · ${LEGAL_VERSION}</p><h1>${escape(document.title)}</h1>${body}<p><a href="/">Вернуться на сайт</a></p></main><footer>© 2026 NORDÉ · <a href="mailto:viperr@angel.com">Обращения: viperr@angel.com</a></footer></body></html>`;
  const versionPath = new URL(`${name}.html`, archive);
  try {
    const existing = await readFile(versionPath, "utf8");
    if (existing !== html)
      throw new Error(
        "Текст опубликованной редакции изменён. Обновите LEGAL_VERSION и сохраните новую редакцию отдельно.",
      );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeFile(new URL(`${name}.html`, root), html);
  await writeFile(versionPath, html);
}
console.log(`Legal documents generated: ${LEGAL_VERSION}`);
