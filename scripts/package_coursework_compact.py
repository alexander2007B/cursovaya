"""Package the current coursework, manuals, drawings and preserved evidence."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
root=Path(__file__).resolve().parents[1];out=root/'docs/coursework-30'
files=list(out.rglob('*'))+list((root/'docs/diagrams').glob('*'))
for match in re.finditer(r'!\[.*?\]\((.*?)\)',(out/'coursework.md').read_text()):
 files.append((out/match[1]).resolve())
for name in ['tests-coverage.txt','e2e.txt','environment.json','load-identity.json','load-gzip.json','mongosh.txt']:
 files.append(root/'docs/reports/norde-final'/name)
files.append(root/'docs/coursework/FORMAT_COMPLIANCE.md')
files += [root/'scripts'/n for n in ['diagrams.py','build_coursework_compact.py','build_coursework_manuals.py','render_coursework_compact.sh','validate_coursework_compact.py','package_coursework_compact.py']]
archive=root/'NORDE_coursework_30_pages.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
 z.writestr('ОТКРОЙТЕ_СНАЧАЛА.txt','Курсовой проект NORDÉ. Редакция оформления 22.11.2026.\nОсновная записка: docs/coursework-30/Baev_NORDE_25-30.docx или .pdf - 30 страниц.\nРуководства: docs/coursework-30/manuals/.\nСхемы PNG и редактируемые SVG: docs/diagrams/.\nОписание комплекта и незаполненных реквизитов: docs/coursework-30/README.md.\nИсходные методички сейчас недоступны; требования взяты из сохранённого FORMAT_COMPLIANCE.md.\n')
 for p in sorted(set(files)):
  if p.is_file():z.write(p,p.relative_to(root))
with ZipFile(archive) as z:
 assert z.testzip() is None
 print('Archive:',len(z.namelist()),'files;',round(archive.stat().st_size/1024/1024,2),'MiB')
