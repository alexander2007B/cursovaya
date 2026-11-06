#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export MPLCONFIGDIR=/tmp/norde-matplotlib
export XDG_CACHE_HOME=/tmp/norde-cache
mkdir -p "$MPLCONFIGDIR" "$XDG_CACHE_HOME"
if ! fc-match -f '%{family}' 'XO Thames' | rg -q 'XO Thames'; then
  echo 'XO Thames is required. Install the official MyOffice XO Thames 1.1 fonts or set FONTCONFIG_FILE before rendering.' >&2
  exit 1
fi
python scripts/diagrams.py
for iteration in 1 2 3; do
  python scripts/build_coursework.py
  soffice -env:UserInstallation=file:///tmp/norde-course-lo --headless --convert-to pdf --outdir docs/coursework docs/coursework/Baev_NORDE.docx
  python - <<'PY'
from pathlib import Path
import re,json,fitz
pdf=fitz.open('docs/coursework/Baev_NORDE.pdf')
struct=json.loads(Path('docs/coursework/document-structure.json').read_text())
normalize=lambda s:re.sub(r'\s+',' ',s).strip()
mapping={}
for _,heading in struct['headings']:
 for i,page in enumerate(pdf):
  if i<2:continue
  text=page.get_text()
  found=(re.search(r'(?m)^\s*'+re.escape(heading)+r'\s*$',text) if heading.startswith('Приложение ') else normalize(heading) in normalize(text))
  if found:mapping[heading]=i+1;break
if len(mapping)!=len(struct['headings']):raise RuntimeError('Headings missing from PDF: '+str(set(t for _,t in struct['headings'])-mapping.keys()))
Path('docs/coursework/toc-pages.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
print('TOC:',len(mapping),'headings;',len(pdf),'pages;',mapping['Приложение 1']-1,'pages before appendices')
PY
done
