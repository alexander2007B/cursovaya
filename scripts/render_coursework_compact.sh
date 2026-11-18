#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for iteration in 1 2 3; do
  python3 scripts/build_coursework_compact.py
  soffice -env:UserInstallation=file:///tmp/norde-compact-lo --headless --convert-to pdf --outdir docs/coursework-30 docs/coursework-30/Baev_NORDE_25-30.docx
  python3 - <<'PY'
from pathlib import Path
import re,json,fitz
out=Path('docs/coursework-30');pdf=fitz.open(out/'Baev_NORDE_25-30.pdf');struct=json.loads((out/'document-structure.json').read_text());mapping={}
normalize=lambda s:re.sub(r'\s+',' ',s).strip()
for _,heading in struct['headings']:
 for i,page in enumerate(pdf):
  if i<2:continue
  text=page.get_text()
  found=re.search(r'(?m)^\s*'+re.escape(heading)+r'\s*$',text) if heading.startswith('Приложение ') else normalize(heading) in normalize(text)
  if found:mapping[heading]=i+1;break
assert len(mapping)==len(struct['headings']), set(t for _,t in struct['headings'])-mapping.keys()
(out/'toc-pages.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
print('PAGES',len(pdf),'TOC entries',len(mapping))
PY
done
