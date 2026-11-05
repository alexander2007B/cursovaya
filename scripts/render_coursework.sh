#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export MPLCONFIGDIR=/tmp/avtobaza-matplotlib
export XDG_CACHE_HOME=/tmp/avtobaza-cache
mkdir -p "$MPLCONFIGDIR" "$XDG_CACHE_HOME"
python scripts/diagrams.py
for iteration in 1 2 3; do
  python scripts/build_coursework.py
  soffice -env:UserInstallation=file:///tmp/avtobaza-lo --headless --convert-to pdf --outdir docs/coursework docs/coursework/Baev_Avtobaza.docx
  pdftotext -layout docs/coursework/Baev_Avtobaza.pdf /tmp/avtobaza-course.txt
  python - <<'PY'
from pathlib import Path
import re,json
pages=Path('/tmp/avtobaza-course.txt').read_text().split('\f')
source=Path('docs/coursework/coursework.md').read_text()
headings=[m[1] for line in source.splitlines() if (m:=re.match(r'^#{1,3} (.+)$',line))]
normalize=lambda s:re.sub(r'\s+',' ',s).strip()
mapping={}
for heading in headings:
 for i,page in enumerate(pages[2:],3):
  if normalize(heading) in normalize(page):mapping[heading]=i;break
if len(mapping)!=len(headings):raise RuntimeError('Some headings missing from PDF')
Path('docs/coursework/toc-pages.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
print('TOC:',len(mapping),'headings;',len(pages)-1,'pages')
PY
done
