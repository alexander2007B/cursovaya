"""Package the current Python coursework and its real evidence."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import re
root=Path(__file__).resolve().parents[1];out=root/'docs/coursework-30'
files=list(out.rglob('*'))+list((root/'docs/diagrams').glob('*'))+list((root/'docs/mermaid').glob('*'))
for folder in ['docs/reports/python-final','docs/reports/red-green','tests/python','tests/postman','tests/tdd_demo']:
 files+=list((root/folder).glob('*'))
for source in [out/'coursework.md',*(out/'manuals').glob('*.md')]:
 for m in re.finditer(r'!\[.*?\]\((.*?)\)',source.read_text()):files.append((source.parent/m[1]).resolve())
files += [root/n for n in ['README.md','requirements.txt','requirements-test.txt','requirements-docs.txt','pytest.ini','docs/TESTING.md','docs/API.md','docs/postman_collection.json','docs/RENDER_PYTHON.md','docs/PYTHON_MIGRATION.md','docs/screenshots/coursework/load-comparison.png']]
files += list((root/'scripts').glob('*.py'))+list((root/'scripts').glob('*.sh'))
archive=root/'NORDE_coursework_30_pages.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
 z.writestr('ОТКРОЙТЕ_СНАЧАЛА.txt','NORDÉ: редакция Python от 27.11.2026.\nКурсовая Word/PDF: docs/coursework-30/Baev_NORDE_25-30.*\nРуководства и атлас экранов: docs/coursework-30/manuals/.\nТесты: 15 pytest + 15 HTTP-сценариев коллекции Postman, 12 нагрузочных повторов. Протоколы: docs/reports/python-final/.\nИсходный проект: https://github.com/alexander2007B/cursovaya/tree/python-only. Для запуска нужен Python, без сборки интерфейса. Размещение Python требует Web Service; инструкция docs/RENDER_PYTHON.md.\n')
 for p in sorted(set(files)):
  if p.is_file() and '__pycache__' not in p.parts:z.write(p,p.relative_to(root))
with ZipFile(archive) as z:assert z.testzip() is None;print(len(z.namelist()),'files;',round(archive.stat().st_size/1024/1024,2),'MiB')
