from pathlib import Path
import re,zipfile
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH as A
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/coursework-30'
for source in (OUT/'manuals').glob('*.md'):
 d=Document();sec=d.sections[0]
 sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.left_margin=Cm(3);sec.right_margin=Cm(1.5);sec.top_margin=Cm(2);sec.bottom_margin=Cm(2)
 for name in ['Normal','Heading 1','Heading 2']:
  st=d.styles[name];st.font.name='XO Thames';st.font.size=Pt(12);st.font.color.rgb=RGBColor(0,0,0)
  for a in ['w:ascii','w:hAnsi','w:eastAsia','w:cs']:st.element.get_or_add_rPr().get_or_add_rFonts().set(qn(a),'XO Thames')
  st.paragraph_format.line_spacing=1.5;st.paragraph_format.space_after=Pt(6);st.paragraph_format.widow_control=True
 d.styles['Normal'].paragraph_format.first_line_indent=Cm(1.25);d.styles['Normal'].paragraph_format.alignment=A.JUSTIFY
 p=sec.footer.paragraphs[0];p.alignment=A.CENTER
 f=OxmlElement('w:fldSimple');f.set(qn('w:instr'),'PAGE');p._p.append(f)
 code=False
 for block in re.split(r'\n\s*\n',source.read_text().strip()):
  if block.startswith('```'):
   for line in block.splitlines()[1:-1]:
    p=d.add_paragraph(line);p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.line_spacing=1
   continue
  if block.startswith('# '):d.add_heading(block[2:],level=1)
  elif block.startswith('## '):d.add_heading(block[3:],level=2)
  else:d.add_paragraph(block)
 d.core_properties.author='Баев Александр';d.core_properties.title=source.read_text().splitlines()[0][2:]
 dest=source.with_suffix('.docx');d.save(dest)
 # Reuse the font embedding already validated in the principal document.
 with zipfile.ZipFile(OUT/'Baev_NORDE_25-30.docx') as z:fonts={n:z.read(n) for n in z.namelist() if n=='word/fontTable.xml' or n=='word/_rels/fontTable.xml.rels' or n.startswith('word/fonts/')}
 with zipfile.ZipFile(dest) as z:files={n:z.read(n) for n in z.namelist()}
 files.update(fonts)
 from lxml import etree as E
 ct=E.fromstring(files['[Content_Types].xml']);ns='http://schemas.openxmlformats.org/package/2006/content-types'
 n=E.SubElement(ct,'{'+ns+'}Default');n.set('Extension','odttf');n.set('ContentType','application/vnd.openxmlformats-officedocument.obfuscatedFont');files['[Content_Types].xml']=E.tostring(ct,xml_declaration=True,encoding='UTF-8',standalone=True)
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
  for n,data in files.items():z.writestr(n,data)
 print(dest.name)
