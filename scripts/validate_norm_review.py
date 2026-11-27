"""Validate the current Word against the user's clarified formatting notes."""
from pathlib import Path
from zipfile import ZipFile
import json,re,shutil
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH as A
from docx.oxml.ns import qn
import fitz
root=Path(__file__).resolve().parents[1];out=root/'docs/coursework-30';d=Document(out/'Baev_NORDE_25-30.docx');pdf=fitz.open(out/'Baev_NORDE_25-30.pdf')
assert d.styles['Normal'].font.name=='Times New Roman'
sec=d.sections[0];assert [round(x/36000,1) for x in [sec.left_margin,sec.right_margin,sec.top_margin,sec.bottom_margin]]==[30,15,20,20]
for name in ['Heading 1','Heading 2','Heading 3']:
 f=d.styles[name].paragraph_format;assert f.line_spacing==1 and f.space_before.pt>0 and f.space_after.pt>0
 if name!='Heading 1':assert abs(f.first_line_indent.cm-1.25)<.01
for p in d.paragraphs:
 if p.style.name in ['Heading 2','Heading 3']:assert p.paragraph_format.page_break_before is not True
 if p.style.name=='Heading 1':assert p.text==p.text.upper() and p.paragraph_format.page_break_before
for table in d.tables:
 assert table.rows[0]._tr.trPr.find(qn('w:tblHeader')) is not None
 for i,row in enumerate(table.rows):
  assert row._tr.trPr.find(qn('w:cantSplit')) is not None
  for j,cell in enumerate(row.cells):
   for p in cell.paragraphs:
    assert p.paragraph_format.line_spacing==1
    assert p.alignment==(A.CENTER if i==0 or j>0 else A.LEFT)
bib=False;bib_entries=0
for p in d.paragraphs:
 if p.style.name=='Heading 1':bib=p.text.startswith('СПИСОК ИСПОЛЬЗОВАННЫХ')
 if p.style.name=='Appendix Number':bib=False;assert p.alignment==A.RIGHT or d.styles['Appendix Number'].paragraph_format.alignment==A.RIGHT;assert p.paragraph_format.page_break_before
 if bib and re.match(r'^\d+\.',p.text):
  bib_entries+=1;assert p.paragraph_format.line_spacing==1.25 and abs(p.paragraph_format.first_line_indent.cm-1.25)<.01
source=(out/'coursework.md').read_text();assert len(re.findall(r'^\| AC-\d+',source,re.M))==18;assert len(re.findall(r'^\| NFR-\d+',source,re.M))==14
assert '\nИнтернет-источники\n' not in source and '\nЛитература\n' not in source
intro=source.split('# РАЗДЕЛ 1.')[0].strip().split('\n\n')[-1];assert intro.startswith(('Курсовой проект составлен','Курсовой проект состоит'))
assert not re.search(r'\[\d+(?:,\s*\d+)*\]',source) and 'FORMULA:' not in source
with ZipFile(out/'Baev_NORDE_25-30.docx') as z:assert z.read('word/document.xml').decode().count('<a:ln ')==10
for n,page in enumerate(pdf,1):
 for word in page.get_text('words'):assert word[0]>=84 and word[2]<=554,(n,word)
# All NFR rows stay on one page; AC continues with an explicit repeated heading.
find=lambda key:[i+1 for i,page in enumerate(pdf) if key in page.get_text()]
assert len(set(find(f'NFR-{i:02}')[0] for i in range(1,15)))==1
continuation_page=find('AC-10')[0];t=pdf[continuation_page-1].get_text();assert 'Перенос таблицы 3' in t and 'Условие и действие' in t
for key in ['Приложение 1']:assert key in source
assert 'Приложение 2' not in source and 'приложении 2' not in source
assert 25<=len(pdf)<=30
report={'status':'current notes checked; earlier numbering clarification pending','preview_pages':len(pdf),'functional_requirements':18,'nonfunctional_requirements':14,'logical_tables':6,'table_blocks':len(d.tables),'bordered_figures':10,'bibliography_entries':bib_entries,'headings_line_spacing':1,'bibliography_line_spacing':1.25,'font':'Times New Roman','local_pdf_font_substitution':True,'note':'Word specifies Times New Roman; preview host lacks it. Final pagination should be checked in Microsoft Word.'}
(out/'norm-review-draft.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
