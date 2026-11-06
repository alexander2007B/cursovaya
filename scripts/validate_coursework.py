from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import fitz,json,re,hashlib
root=Path(__file__).resolve().parents[1];folder=root/'docs/coursework';docx=folder/'Baev_NORDE.docx';pdf=fitz.open(folder/'Baev_NORDE.pdf');ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
checks={}
with ZipFile(docx) as z:
 d=E.fromstring(z.read('word/document.xml'));styles=E.fromstring(z.read('word/styles.xml'));sect=d.find('.//w:sectPr',ns)
 margins=sect.find('w:pgMar',ns);size=sect.find('w:pgSz',ns)
 attr=lambda e,k:int(e.get('{'+ns['w']+'}'+k))
 checks['A4']=abs(attr(size,'w')-11906)<=1 and abs(attr(size,'h')-16838)<=1
 checks['margins_mm_30_15_20_20']=all(abs(attr(margins,k)-v)<=1 for k,v in {'left':1701,'right':850,'top':1134,'bottom':1134}.items())
 normal=styles.xpath('//w:style[@w:styleId="Normal"]',namespaces=ns)[0]
 checks['font_XO_Thames_12']=normal.find('w:rPr/w:rFonts',ns).get('{'+ns['w']+'}ascii')=='XO Thames' and attr(normal.find('w:rPr/w:sz',ns),'val')==24
 checks['indent_1_25cm']=abs(attr(normal.find('w:pPr/w:ind',ns),'firstLine')-709)<=1
 checks['line_spacing_1_5']=attr(normal.find('w:pPr/w:spacing',ns),'line')==360
 checks['justified_body']=normal.find('w:pPr/w:jc',ns).get('{'+ns['w']+'}val')=='both'
 checks['headings_not_bold']=all(s.find('w:rPr/w:b',ns).get('{'+ns['w']+'}val')=='0' for s in styles.xpath('//w:style[starts-with(@w:styleId,"Heading")]',namespaces=ns) if s.get('{'+ns['w']+'}styleId') in ['Heading1','Heading2','Heading3'])
 checks['title_page_without_number']=sect.find('w:titlePg',ns) is not None and not any(s['text'].strip().isdigit() for b in pdf[0].get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['bbox'][1]>780)
 checks['embedded_font_files']=len([n for n in z.namelist() if n.endswith('.odttf')])==2
 checks['tables_font_12_single_spacing']=all(attr(r.find('w:rPr/w:sz',ns),'val')==24 for r in d.xpath('//w:tbl//w:r[w:t]',namespaces=ns)) and all(attr(p.find('w:pPr/w:spacing',ns),'line')==240 for p in d.xpath('//w:tbl//w:p',namespaces=ns))
 checks['table_headers_centered']=all(p.find('w:pPr/w:jc',ns).get('{'+ns['w']+'}val')=='center' for p in d.xpath('//w:tbl/w:tr[1]//w:p',namespaces=ns))
 checks['all_body_runs_black']=all(c.get('{'+ns['w']+'}val')=='000000' for c in d.xpath('//w:rPr/w:color',namespaces=ns))
 checks['tables_count_14']=len(d.findall('.//w:tbl',ns))==14
struct=json.loads((folder/'document-structure.json').read_text());mapping=json.loads((folder/'toc-pages.json').read_text());normalize=lambda s:re.sub(r'\s+',' ',s).strip()
checks['TOC_pages_correct']=all(normalize(title) in normalize(pdf[num-1].get_text()) for title,num in mapping.items())
checks['TOC_all_headings']=len(mapping)==len(struct['headings'])
checks['appendices_after_bibliography']=mapping['Приложение 1']>mapping['СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ']
checks['appendix_names_excluded_from_TOC']='Руководство по запуску и демонстрации' not in pdf[1].get_text()
checks['body_at_least_25_pages']=mapping['СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ']-mapping['ВВЕДЕНИЕ']>=25
checks['PDF_only_XO_Thames']=all('XOThames' in s['font'] for page in pdf for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'])
checks['PDF_font_size_12']=all(abs(s['size']-12)<.1 for page in pdf for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'])
checks['figures_22']=len(struct['figures'])==22
body='\n'.join(p.get_text() for p in pdf)
checks['two_numbered_formulas']='C = B' in body and '(1)' in body and '(2)' in body
checks['all_figures_referenced']=all(re.search(r'рисунке\s+'+str(i)+r'\b',body) for i in range(1,23))
checks['all_tables_referenced']=all(re.search(r'таблице\s+'+str(i)+r'\b',body) for i in range(1,15))
refs=json.loads((root/'docs/reports/norde-final/bibliography.json').read_text());checks['at_least_15_sources']=len(refs)>=15
checks['no_unresolved_template_markers']='{{' not in body and 'APPENDIX_TITLE' not in body and 'FORMULA:' not in body
checks['no_text_outside_printable_area']=all(84<=c['bbox'][0] and c['bbox'][2]<=554 and c['bbox'][1]>=52 for page in pdf for b in page.get_text('rawdict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] for c in s['chars'] if not c['c'].isspace() and c['bbox'][1]<775)
report={'date':'2026-11-06','pages':len(pdf),'body_pages_excluding_title_TOC_references_appendices':mapping['СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ']-mapping['ВВЕДЕНИЕ'],'figures':22,'tables':14,'sources':len(refs),'checks':checks,'all_passed':all(checks.values()),'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [docx,folder/'Baev_NORDE.pdf']}}
(folder/'format-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['all_passed']:raise SystemExit('Validation failed')
