"""Build the final coursework using the supplied VKSIT Regulation §§6.1–6.15."""
from pathlib import Path
import re,json,uuid,zipfile
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH as A,WD_TAB_ALIGNMENT,WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image
from lxml import etree as ET
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/coursework';OUT.mkdir(exist_ok=True)
FONT='XO Thames';source=(OUT/'coursework.md').read_text()
versions=json.loads((ROOT/'docs/reports/norde-final/versions.json').read_text())['dependencies']
selected=['express','mongoose','react','vite','@playwright/test','zod','autocannon','sharp','react-imask']
rows='| Компонент | Версия |\n|---|---|\n| Node.js | 24.22.1 |\n| MongoDB | '+json.loads((ROOT/'docs/reports/norde-final/environment.json').read_text())['mongodb']+' |\n'
rows+='\n'.join('| '+name+' | '+versions[name]['version']+' |' for name in selected)
source=source.replace('{{VERSIONS}}',rows).replace('→','—')
source=source.replace('Шрифт пояснительной записки задаётся отдельно Положением колледжа.','Шрифт пояснительной записки задаётся отдельно Положением колледжа [19].')
# Number figures in reading order and supply the required first textual references.
figures=[];lines=[]
for line in source.splitlines():
 m=re.match(r'!\[(.*?)\]\((.*?)\)',line.strip())
 if m:
  title=re.sub(r'^Рисунок\s+\d+\s*[—.\-]\s*','',m[1]);n=len(figures)+1;figures.append({'number':n,'title':title,'path':m[2]})
  lines+=['',f'Соответствующий результат представлен на рисунке {n}.','',f'![Рисунок {n}. {title}]({m[2]})']
 else:lines.append(line)
source='\n'.join(lines)+'\n'
(OUT/'coursework-final.md').write_text(source)
headings=[(len(m[1]),m[2]) for line in source.splitlines() if (m:=re.match(r'^(#{1,3}) (.+)$',line))]
pages=json.loads((OUT/'toc-pages.json').read_text()) if (OUT/'toc-pages.json').exists() else {}
doc=Document();sec=doc.sections[0]
sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.left_margin=Cm(3);sec.right_margin=Cm(1.5);sec.top_margin=Cm(2);sec.bottom_margin=Cm(2);sec.footer_distance=Cm(1)
normal=doc.styles['Normal'];normal.font.name=FONT;normal.font.size=Pt(12);normal.font.color.rgb=RGBColor(0,0,0)
nf=normal.paragraph_format;nf.line_spacing=1.5;nf.space_before=Pt(0);nf.space_after=Pt(0);nf.first_line_indent=Cm(1.25);nf.alignment=A.JUSTIFY;nf.widow_control=True
for name in ['Normal','Heading 1','Heading 2','Heading 3']:
 st=doc.styles[name];st.font.name=FONT;st.font.size=Pt(12);st.font.color.rgb=RGBColor(0,0,0)
 for attr in ['w:ascii','w:hAnsi','w:eastAsia','w:cs']:st.element.get_or_add_rPr().get_or_add_rFonts().set(qn(attr),FONT)
 fonts=st.element.get_or_add_rPr().get_or_add_rFonts()
 for attr in list(fonts.attrib):
  if attr.endswith('Theme'):del fonts.attrib[attr]
 lang=OxmlElement('w:lang');lang.set(qn('w:val'),'ru-RU');st.element.get_or_add_rPr().append(lang)
 if name!='Normal':
  st.font.bold=False;st.font.italic=False;pf=st.paragraph_format;pf.first_line_indent=Cm(0 if name=='Heading 1' else 1.25);pf.alignment=A.CENTER if name=='Heading 1' else A.LEFT;pf.space_before=Pt(18);pf.space_after=Pt(18);pf.line_spacing=1.5;pf.keep_with_next=True
for key in ['autoHyphenation']:
 node=OxmlElement('w:'+key);node.set(qn('w:val'),'0');doc.settings.element.append(node)
sec.different_first_page_header_footer=True
p=sec.footer.paragraphs[0];p.alignment=A.CENTER;p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.line_spacing=1
run=p.add_run();run.font.name=FONT;run.font.size=Pt(12);field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');run._r.addnext(field)
def para(text='',align=None,indent=1.25,before=0,after=0,spacing=1.5,bold=False,keep=False):
 p=doc.add_paragraph();f=p.paragraph_format;f.first_line_indent=Cm(indent);f.line_spacing=spacing;f.space_before=Pt(before);f.space_after=Pt(after);f.keep_with_next=keep
 if align is not None:p.alignment=align
 r=p.add_run(text);r.font.name=FONT;r.font.size=Pt(12);r.font.color.rgb=RGBColor(0,0,0);r.bold=bold
 return p
# Title follows the college's supplied example; missing information stays blank.
para('автономное профессиональное образовательное учреждение\nВологодской области\n«Вологодский колледж связи и информационных технологий»',A.CENTER,0,after=38)
para('КУРСОВОЙ ПРОЕКТ',A.CENTER,0,after=18)
para('по МДК «Поддержка и тестирование\nпрограммных модулей»',A.CENTER,0,after=24)
para('РАЗРАБОТКА И ОБЕСПЕЧЕНИЕ КАЧЕСТВА\nВЕБ-ПРИЛОЖЕНИЯ ДЛЯ АРЕНДЫ АВТОМОБИЛЕЙ\nИ УЧЁТА СОСТОЯНИЯ АВТОПАРКА «NORDÉ»',A.CENTER,0,after=30)
para('Группа: ____________________\nСпециальность: __________________________________________',A.LEFT,0,after=20)
for t in ['Студент: _______________ (Баев Александр)','Руководитель: __________________________','Нормоконтролёр: ________________________']:
 p=para(t,A.LEFT,0,after=8);p.paragraph_format.left_indent=Cm(5.5)
para('«_____» __________________ 2026 г.',A.RIGHT,0,after=30)
para('Вологда\n2026 г.',A.CENTER,0,before=25)
# TOC field with a usable cached result. Appendix names are excluded.
p=para('СОДЕРЖАНИЕ',A.CENTER,0,after=18);p.paragraph_format.page_break_before=True
first_toc=True;last_toc=None
for level,title in headings:
 p=para('',A.LEFT,0,spacing=1.5);p.paragraph_format.left_indent=Cm(.5*(level-1));p.paragraph_format.tab_stops.add_tab_stop(Cm(16.5-.5*(level-1)),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
 if first_toc:
  r=p.add_run();begin=OxmlElement('w:fldChar');begin.set(qn('w:fldCharType'),'begin');r._r.append(begin)
  r=p.add_run();ins=OxmlElement('w:instrText');ins.set(qn('xml:space'),'preserve');ins.text=' TOC \\o "1-3" \\h \\z \\t "Appendix Number,1" ';r._r.append(ins)
  r=p.add_run();sep=OxmlElement('w:fldChar');sep.set(qn('w:fldCharType'),'separate');r._r.append(sep);first_toc=False
 r=p.add_run(title+'\t'+str(pages.get(title,'00')));r.font.name=FONT;r.font.size=Pt(12);last_toc=p
r=last_toc.add_run();end=OxmlElement('w:fldChar');end.set(qn('w:fldCharType'),'end');r._r.append(end)
# Explicit appendix-number style, independent of its centered bold title.
if 'Appendix Number' not in doc.styles:
 st=doc.styles.add_style('Appendix Number',1);st.base_style=normal
st=doc.styles['Appendix Number'];st.font.name=FONT;st.font.size=Pt(12);st.font.bold=False;st.paragraph_format.alignment=A.RIGHT;st.paragraph_format.first_line_indent=Cm(0);st.paragraph_format.keep_with_next=True
captions=['Термины предметной области', 'Сравнение открытых клиентских интерфейсов', 'Функциональные требования', 'Нефункциональные требования и критерии приёмки', 'Инфологическое описание коллекций', 'Классы эквивалентности и границы ввода', 'Проверяемые примеры цикла разработки', 'Области интеграционного тестирования', 'Основные сквозные сценарии', 'Нагрузочные результаты чтения каталога', 'Журнал дефектов и исправлений', 'Покрытие требований проверками', 'Исходные артефакты проекта', 'Версии инструментальных средств']
table_records=[]
def table(group):
 rows=[[s.strip() for s in line.strip().strip('|').split('|')] for line in group];rows=[r for r in rows if not all(re.fullmatch(r'[:\- ]+',c or '-') for c in r)]
 n=len(table_records)+1;title=captions[n-1] if n<=len(captions) else 'Сводные данные проекта';table_records.append({'number':n,'title':title,'rows':len(rows),'columns':len(rows[0])})
 para(f'Сводные данные приведены в таблице {n}.')
 para(f'Таблица {n}',A.RIGHT,0,before=6,spacing=1,keep=True)
 para(title,A.CENTER,0,after=6,spacing=1,keep=True)
 cols=len(rows[0]);widths={2:[5,11.5],3:[2,6.7,7.8] if rows[0][0]=='Код' else [4,6,6.5],4:[2.5,4.7,4.7,4.6],5:[4.2,3.1,3.1,3.0,3.1],6:[3.2,2.6,2.8,2.2,3,2.7]}[cols]
 t=doc.add_table(rows=0,cols=cols);t.style='Table Grid';t.autofit=False
 ind=OxmlElement('w:tblInd');ind.set(qn('w:w'),'108');ind.set(qn('w:type'),'dxa');t._tbl.tblPr.append(ind)
 for c,w in zip(t.columns,widths):c.width=Cm(w)
 for ri,row in enumerate(rows):
  cells=t.add_row().cells
  for ci,val in enumerate(row):
   cells[ci].width=Cm(widths[ci]);p=cells[ci].paragraphs[0];f=p.paragraph_format;f.first_line_indent=Cm(0);f.line_spacing=1;f.space_before=Pt(3);f.space_after=Pt(3);p.alignment=A.CENTER if ri==0 else A.LEFT
   r=p.add_run(val);r.font.name=FONT;r.font.size=Pt(12);r.bold=False;r.font.color.rgb=RGBColor(0,0,0)
  trPr=t.rows[-1]._tr.get_or_add_trPr();trPr.append(OxmlElement('w:cantSplit'))
  if ri==0:trPr.append(OxmlElement('w:tblHeader'))
 para('',indent=0,spacing=1,after=6)
lines=source.splitlines();i=0
while i<len(lines):
 line=lines[i].strip()
 if not line:i+=1;continue
 if line.startswith('#'):
  m=re.match(r'^(#{1,3}) (.+)$',line);level=len(m[1]);title=m[2]
  if title.startswith('Приложение '):p=doc.add_paragraph(title,style='Appendix Number');p.paragraph_format.page_break_before=True
  else:
   p=doc.add_heading(title,level=level)
   if level==1:p.paragraph_format.page_break_before=True
  i+=1;continue
 if line.startswith('FORMULA:'):
  expression,number=line[len('FORMULA:'):].rsplit('|',1)
  p=para('',A.LEFT,0,before=18,after=18)
  p.paragraph_format.tab_stops.add_tab_stop(Cm(8.25),WD_TAB_ALIGNMENT.CENTER)
  p.paragraph_format.tab_stops.add_tab_stop(Cm(16.5),WD_TAB_ALIGNMENT.RIGHT)
  r=p.add_run('\t'+expression.strip()+'\t('+number.strip()+')');r.font.name=FONT;r.font.size=Pt(12)
  i+=1;continue
 if line.startswith('APPENDIX_TITLE:'):
  para(line.split(':',1)[1].strip(),A.CENTER,0,after=18,bold=True,keep=True);i+=1;continue
 if line.startswith('|'):
  group=[]
  while i<len(lines) and lines[i].strip().startswith('|'):group.append(lines[i]);i+=1
  table(group);continue
 if line.startswith('!['):
  m=re.match(r'!\[(.*?)\]\((.*?)\)',line);path=(OUT/m[2]).resolve();w,h=Image.open(path).size;cmw=min(16.5,16*w/h)
  p=para('',A.CENTER,0,spacing=1,keep=True);p.add_run().add_picture(str(path),width=Cm(cmw));para(m[1],A.CENTER,0,after=12,spacing=1.5);i+=1;continue
 if line.startswith('```'):
  i+=1
  while i<len(lines) and not lines[i].startswith('```'):
   p=para(lines[i],A.LEFT,0,spacing=1);p.paragraph_format.keep_with_next=i+1<len(lines) and not lines[i+1].startswith('```');i+=1
  i+=1;continue
 # A bibliography entry retains its actual number, independent of list autoformat.
 para(line);i+=1
props=doc.core_properties;props.title='Разработка и обеспечение качества веб-приложения для аренды автомобилей и учёта состояния автопарка NORDÉ';props.author='Баев Александр';props.subject='Курсовой проект · ВКСИИТ';props.language='ru-RU'
path=OUT/'Baev_NORDE.docx';doc.save(path)
# Embed the actual unrestricted-embedding XO Thames font files (OS/2 fsType=0).
# Fonts come from the official MyOffice distribution, never from a substitute face.
fontdir=ROOT.parent/'.coursework-fonts/TTF'
if fontdir.exists():
 with zipfile.ZipFile(path) as z:files={n:z.read(n) for n in z.namelist()}
 W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';P='http://schemas.openxmlformats.org/package/2006/relationships'
 ft=ET.fromstring(files['word/fontTable.xml']);node=next((n for n in ft if n.get('{'+W+'}name')==FONT),None)
 if node is None:node=ET.SubElement(ft,'{'+W+'}font');node.set('{'+W+'}name',FONT)
 relpath='word/_rels/fontTable.xml.rels';rels=ET.fromstring(files[relpath]) if relpath in files else ET.Element('{'+P+'}Relationships',nsmap={None:P})
 for kind,suffix in [('Regular','Nu'),('Bold','Bu')]:
  data=bytearray((fontdir/f'XO_Thames_{suffix}.ttf').read_bytes());key=uuid.uuid4();xor=key.bytes[::-1]
  for j in range(32):data[j]^=xor[j%16]
  name='XOThames-'+kind+'.odttf';files['word/fonts/'+name]=bytes(data);rid='rIdXO'+kind
  rel=ET.SubElement(rels,'{'+P+'}Relationship');rel.set('Id',rid);rel.set('Type',R+'/font');rel.set('Target','fonts/'+name)
  emb=ET.SubElement(node,'{'+W+'}embed'+kind);emb.set('{'+R+'}id',rid);emb.set('{'+W+'}fontKey','{'+str(key).upper()+'}');emb.set('{'+W+'}subsetted','false')
 files['word/fontTable.xml']=ET.tostring(ft,xml_declaration=True,encoding='UTF-8',standalone=True);files[relpath]=ET.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
 ct=ET.fromstring(files['[Content_Types].xml']);ns='http://schemas.openxmlformats.org/package/2006/content-types'
 if not any(n.get('Extension')=='odttf' for n in ct):n=ET.SubElement(ct,'{'+ns+'}Default');n.set('Extension','odttf');n.set('ContentType','application/vnd.openxmlformats-officedocument.obfuscatedFont')
 files['[Content_Types].xml']=ET.tostring(ct,xml_declaration=True,encoding='UTF-8',standalone=True)
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
  for n,data in files.items():z.writestr(n,data)
(OUT/'document-structure.json').write_text(json.dumps({'headings':headings,'figures':figures,'tables':table_records,'font':FONT,'fontSizePt':12},ensure_ascii=False,indent=2))
print(path,';',len(figures),'figures;',len(table_records),'tables')
