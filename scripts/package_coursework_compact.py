"""Package the current coursework, manuals, figures and actual test evidence."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re

root = Path(__file__).resolve().parents[1]
out = root / "docs/coursework-30"
files = list(out.rglob("*")) + list((root / "docs/diagrams").glob("*"))
for source in [out / "coursework.md", *(out / "manuals").glob("*.md")]:
    for match in re.finditer(r"!\[.*?\]\((.*?)\)", source.read_text()):
        files.append((source.parent / match[1]).resolve())
files += list((root / "docs/reports/selenium-pytest-postman").glob("*"))
files += [root / "docs/screenshots/coursework/load-comparison.png"]
files += list((root / "tests/python").glob("*.py")) + [
    root / "tests/fixtures/upload-car.jpg"
]
files += [
    root / n
    for n in [
        "requirements-test.txt",
        "requirements-docs.txt",
        "pytest.ini",
        "docs/TESTING.md",
        "docs/postman_collection.json",
    ]
]
files += [
    root / "scripts" / n
    for n in [
        "diagrams.py",
        "build_coursework_compact.py",
        "build_coursework_manuals.py",
        "render_coursework_compact.sh",
        "validate_coursework_compact.py",
        "package_coursework_compact.py",
        "refresh-coursework-evidence.py",
        "build-postman-tests.py",
        "run-quality.py",
        "test-server.js",
    ]
]
archive = root / "NORDE_coursework_30_pages.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as z:
    z.writestr(
        "ОТКРОЙТЕ_СНАЧАЛА.txt",
        "Курсовой проект NORDÉ. Новые тесты и иллюстрации, 26.11.2026.\nОсновная записка Word/PDF - docs/coursework-30/Baev_NORDE_25-30.*, 30 страниц.\nРуководства пользователя, администратора, план защиты и атлас 15 экранов - docs/coursework-30/manuals/.\nТесты: Selenium + pytest, Postman/Newman; 15 функциональных случаев, 15 API-утверждений, 12 нагрузочных повторов.\nКарта файлов и порядок запуска - docs/TESTING.md.\nПротоколы XML/JSON/TXT - docs/reports/selenium-pytest-postman/.\nСхемы PNG/SVG - docs/diagrams/.\nДля запуска тестов скачайте полный исходный код из https://github.com/alexander2007B/cursovaya, ветка main; этот архив содержит документацию и тестовые материалы.\nТитул: нормоконтролёр, подписи и даты сдачи уточняются.\n",
    )
    for p in sorted(set(files)):
        if p.is_file() and p.name != "newman.json":
            z.write(p, p.relative_to(root))
with ZipFile(archive) as z:
    assert z.testzip() is None
    print(
        "Archive:",
        len(z.namelist()),
        "files;",
        round(archive.stat().st_size / 1024 / 1024, 2),
        "MiB",
    )
