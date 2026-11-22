from pathlib import Path
from zipfile import ZipFile
import json,re,fitz
from lxml import etree as E
from docx import Document
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/coursework-30';pdf=fitz.open(OUT/'Baev_NORDE_25-30.pdf');doc=Document(OUT/'Baev_NORDE_25-30.docx')
assert 25<=len(pdf)<=30,len(pdf)
sec=doc.sections[0]
mm=lambda x:round(x/36000,1)
assert [mm(sec.left_margin),mm(sec.right_margin),mm(sec.top_margin),mm(sec.bottom_margin)]==[30,15,20,20]
assert doc.styles['Normal'].font.name=='XO Thames'
assert doc.styles['Normal'].font.size.pt==12
assert doc.styles['Normal'].paragraph_format.line_spacing==1.5
structure=json.loads((OUT/'document-structure.json').read_text());mapping=json.loads((OUT/'toc-pages.json').read_text());norm=lambda s:re.sub(r'\s+',' ',s).strip()
for _,heading in structure['headings']:
 assert norm(heading) in norm(pdf[mapping[heading]-1].get_text()),heading
text='\n'.join(p.get_text() for p in pdf)
assert '\uFFFD' not in text
assert not any(c in text for c in ['—','–','−','‑']), 'Long dashes remain in PDF'
assert not any(c in ''.join(p.text for p in doc.paragraphs) for c in ['—','–','−','‑'])
assert 'Анна Миронова' not in text
assert 'Дмитрий' in text
assert '18 тестов' not in text
assert '00' not in pdf[1].get_text().split('ВВЕДЕНИЕ')[0]
assert all('Рисунок '+str(n)+'.' in text for n in range(1,len(structure['figures'])+1))
# Check each figure caption and the corresponding image stay on the same page.
for fig in structure['figures']:
 pages=[i+1 for i,p in enumerate(pdf) if f"Рисунок {fig['number']}." in p.get_text()]
 assert len(pages)==1 and pdf[pages[0]-1].get_image_info(),(fig,pages)
fonts=sorted(set(f[3] for page in pdf for f in page.get_fonts()))
assert all('Thames' in f for f in fonts),fonts
with ZipFile(OUT/'Baev_NORDE_25-30.docx') as z:assert 'word/fonts/XOThames-Regular.odttf' in z.namelist()
geometry=[]
for i,page in enumerate(pdf):
 for word in page.get_text('words'):
  if word[0]<42 or word[2]>page.rect.width-24 or word[1]<28 or word[3]>page.rect.height-20:geometry.append({'page':i+1,'word':word[4],'box':word[:4]})
assert not geometry,geometry[:10]
manuals={}
for p in (OUT/'manuals').glob('*.pdf'):
 m=fitz.open(p);assert all(page.get_text().strip() for page in m);assert not any(c in ''.join(page.get_text() for page in m) for c in ['—','–','−','‑']);manuals[p.name]=len(m)
report={'date':'2026-11-22','pages_total':len(pdf),'pages_before_appendices':mapping['Приложение 1']-1,'figures':len(structure['figures']),'tables':len(structure['tables']),'toc_entries':len(mapping),'font':fonts,'margins_mm':{'left':30,'right':15,'top':20,'bottom':20},'font_size_pt':12,'line_spacing':1.5,'geometry_issues':geometry,'manual_pages':manuals,'current_checks':'Existing protocol: 10 tests without MongoDB passed on 2026-11-18; no new run for this formatting revision','historical_checks':'32 unit/API and 5 E2E from 2026-11-06; no new full API/E2E/load run','original_methodology_files':'Not available; formatting based on prior FORMAT_COMPLIANCE.md','title_missing_fields':['Группа','Специальность','Руководитель','Нормоконтролёр','Подписи']}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
