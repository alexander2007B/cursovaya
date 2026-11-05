from pathlib import Path
import re,json,subprocess,sys
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/coursework';OUT.mkdir(exist_ok=True)
source=(OUT/'coursework.md').read_text()
versions=json.loads((ROOT/'docs/reports/versions.json').read_text())['dependencies']
version_table='| Компонент | Версия |\n|---|---|\n'+'\n'.join(f'| {name} | {info["version"]} |' for name,info in sorted(versions.items()))
source=source.replace('{{VERSIONS}}',version_table)
if (ROOT/'docs/reports/load-before-compression.json').exists() and (ROOT/'docs/reports/load.json').exists():
 before=json.loads((ROOT/'docs/reports/load-before-compression.json').read_text())['results']
 after=json.loads((ROOT/'docs/reports/load.json').read_text())['results']
 table='| Вариант / соединения | Запросов/с | Среднее, мс | p99, мс | Байт/ответ* | Ошибки |\n|---|---|---|---|---|---|\n'
 for label,rows in [('До',before),('После',after)]:
  for r in rows:
   avg=r.get('bytesPerSecond',0)/r['requestsPerSecond']
   table+=f'| {label} / {r["connections"]} | {r["requestsPerSecond"]:.2f} | {r["latencyMeanMs"]:.2f} | {r["latencyP99Ms"]} | {avg:.0f} | {r["errors"]+r["timeouts"]+r["non2xx"]} |\n'
 table+='\n* Оценка по отношению измеренных байтов/с к запросам/с, включая HTTP-заголовки. Фактическая длительность каждого прогона содержится в JSON; остановка генератора может занять дополнительную секунду.'
 source=source.replace('{{LOAD_COMPARISON}}',table)
metrics=(ROOT/'docs/reports/tests-coverage.txt').read_text()
m=re.search(r'all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)',metrics)
if m:
 source=re.sub(r'98,28% строк, 81,71% ветвей и 93,75% функций в зафиксированном прогоне до добавления middleware сжатия\. В окончательном приложении отчёт пересчитывается и прилагается отдельно\.',f'{m[1].replace(".",",")}% строк, {m[2].replace(".",",")}% ветвей и {m[3].replace(".",",")}% функций в итоговом прогоне после добавления middleware сжатия.',source)
(OUT/'coursework-final.md').write_text(source)
headings=[(len(m[1]),m[2]) for line in source.splitlines() if (m:=re.match(r'^(#{1,3}) (.+)$',line))]
pages=json.loads((OUT/'toc-pages.json').read_text()) if (OUT/'toc-pages.json').exists() else {}
doc=Document();sec=doc.sections[0];sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.top_margin=Cm(2);sec.bottom_margin=Cm(2);sec.left_margin=Cm(3);sec.right_margin=Cm(1.5)
normal=doc.styles['Normal'];normal.font.name='Times New Roman';normal.font.size=Pt(14);normal.paragraph_format.line_spacing=1.5;normal.paragraph_format.space_after=Pt(0);normal.paragraph_format.first_line_indent=Cm(1.25);normal.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
for level in [1,2,3]:
 st=doc.styles[f'Heading {level}'];st.font.name='Times New Roman';st.font.size=Pt(14);st.font.bold=True;st.font.color.rgb=RGBColor(0,0,0);st.paragraph_format.first_line_indent=Cm(0);st.paragraph_format.space_before=Pt(15);st.paragraph_format.space_after=Pt(12);st.paragraph_format.keep_with_next=True;st.paragraph_format.line_spacing=1.25
 st.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.CENTER if level==1 else WD_ALIGN_PARAGRAPH.LEFT
lang=OxmlElement('w:lang');lang.set(qn('w:val'),'ru-RU');normal.element.get_or_add_rPr().append(lang)
sec.different_first_page_header_footer=True
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.CENTER;footer.paragraph_format.first_line_indent=Cm(0)
r=footer.add_run();r.font.name='Times New Roman';r.font.size=Pt(12)
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');r._r.addnext(fld)
def centered(text,size=14,bold=False,after=0):
 p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.space_after=Pt(after);r=p.add_run(text);r.font.size=Pt(size);r.bold=bold;return p
centered('ВКСИИТ',16,True,12)
centered('МДК «Поддержка и тестирование программных модулей»',14,False,50)
centered('КУРСОВОЙ ПРОЕКТ',16,True,15)
centered('ПОЯСНИТЕЛЬНАЯ ЗАПИСКА',14,True,20)
centered('Разработка и обеспечение качества\nинформационной системы автоматизации\nаренды и учёта состояния автопарка',16,True,40)
for text in ['Выполнил: Баев Александр','Группа: __________________________','Специальность: ____________________','Руководитель: _____________________']:
 p=doc.add_paragraph(text);p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.left_indent=Cm(7);p.paragraph_format.line_spacing=1.5
centered('2026',14,False,0)
doc.add_page_break();centered('СОДЕРЖАНИЕ',14,True,18)
for level,title in headings:
 p=doc.add_paragraph();p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.left_indent=Cm(.4 if level>1 else 0);p.paragraph_format.line_spacing=1.1;p.paragraph_format.space_after=Pt(4);p.paragraph_format.tab_stops.add_tab_stop(Cm(16),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
 run=p.add_run(title+'\t'+str(pages.get(title,'00')));run.font.size=Pt(11);run.bold=level==1

def paragraph(text):
 p=doc.add_paragraph(text);return p

def table(lines):
 rows=[[s.strip() for s in line.strip().strip('|').split('|')] for line in lines]
 rows=[r for r in rows if not all(re.fullmatch(r'[:\- ]+',c or '-') for c in r)]
 t=doc.add_table(rows=0,cols=len(rows[0]));t.style='Table Grid';t.autofit=True
 for ri,row in enumerate(rows):
  cells=t.add_row().cells
  for ci,val in enumerate(row):
   p=cells[ci].paragraphs[0];p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.line_spacing=1;p.paragraph_format.space_after=Pt(4);p.paragraph_format.space_before=Pt(4);p.alignment=WD_ALIGN_PARAGRAPH.LEFT
   run=p.add_run(val);run.font.name='Times New Roman';run.font.size=Pt(10);run.bold=ri==0
  trPr=t.rows[-1]._tr.get_or_add_trPr();nosplit=OxmlElement('w:cantSplit');trPr.append(nosplit)
  if ri==0:
   repeat=OxmlElement('w:tblHeader');trPr.append(repeat)
   for c in cells:
    shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'EAF0E7');c._tc.get_or_add_tcPr().append(shade)
 doc.add_paragraph().paragraph_format.line_spacing=.2

lines=source.splitlines();i=0;first=True
while i<len(lines):
 line=lines[i].strip()
 if not line:i+=1;continue
 if line.startswith('#'):
  m=re.match(r'^(#{1,3}) (.+)$',line);level=len(m[1]);title=m[2]
  if level==1:doc.add_page_break()
  doc.add_heading(title,level=level);i+=1;continue
 if line.startswith('|'):
  group=[]
  while i<len(lines) and lines[i].strip().startswith('|'):group.append(lines[i]);i+=1
  table(group);continue
 if line.startswith('!['):
  m=re.match(r'!\[(.*?)\]\((.*?)\)',line);img=(OUT/m[2]).resolve();w,h=Image.open(img).size;maxw=16.0;maxh=17.0;cmw=min(maxw,maxh*w/h)
  p=doc.add_paragraph();p.paragraph_format.first_line_indent=Cm(0);p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.keep_with_next=True;p.paragraph_format.line_spacing=1;p.add_run().add_picture(str(img),width=Cm(cmw))
  p=centered(m[1],12);p.paragraph_format.line_spacing=1.15;p.paragraph_format.space_after=Pt(12);i+=1;continue
 if line.startswith('```'):
  i+=1;code=[]
  while i<len(lines) and not lines[i].startswith('```'):code.append(lines[i]);i+=1
  p=doc.add_paragraph();p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.line_spacing=1;p.paragraph_format.space_before=Pt(8);p.paragraph_format.space_after=Pt(8)
  r=p.add_run('\n'.join(code));r.font.name='Courier New';r.font.size=Pt(9);i+=1;continue
 paragraph(line);i+=1
props=doc.core_properties;props.title='Разработка и обеспечение качества информационной системы автоматизации аренды и учёта состояния автопарка';props.author='Баев Александр';props.subject='Курсовой проект · ВКСИИТ';props.language='ru-RU'
path=OUT/'Baev_Avtobaza.docx';doc.save(path);print(path)
