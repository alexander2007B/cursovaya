"""Export the project's Mermaid source through a normal local HTTP application.
Use an activated requirements-test.txt environment. Set MERMAID_DIST to the
installed mermaid/dist directory, or use the npm-exec cache discovered below.
No browser policies are changed.
"""
from pathlib import Path
import functools,http.server,os,tempfile,threading,shutil,json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
root=Path(__file__).resolve().parents[1];os.chdir(root)
candidates=list((Path.home()/'.npm/_npx').glob('*/node_modules/mermaid/dist'))
dist=Path(os.environ['MERMAID_DIST']) if os.environ.get('MERMAID_DIST') else (candidates[0] if candidates else None)
if dist is None:raise SystemExit('Install Mermaid and set MERMAID_DIST to its dist directory')
class QuietHandler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
with tempfile.TemporaryDirectory(prefix='norde-mermaid-') as directory:
 page=Path(directory);(page/'mermaid').symlink_to(dist.resolve(),target_is_directory=True)
 shutil.copy2(root/'docs/mermaid/render-page.html',page/'index.html')
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=directory))
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 opts=Options();opts.binary_location=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
 for arg in ['--headless=new','--no-sandbox','--disable-dev-shm-usage']:opts.add_argument(arg)
 try:
  with webdriver.Chrome(options=opts) as d:
   d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':2400,'height':1800,'deviceScaleFactor':3,'mobile':False})
   d.get('http://127.0.0.1:'+str(server.server_port));WebDriverWait(d,20).until(lambda d:d.execute_script('return window.ready===true'))
   for src in sorted((root/'docs/mermaid').glob('*.mmd')):
    svg=d.execute_async_script('const done=arguments[arguments.length-1];renderDiagram(arguments[0]).then(done).catch(e=>done("ERROR:"+e.message));',src.read_text())
    if svg.startswith('ERROR:'):raise RuntimeError(src.name+': '+svg)
    (root/'docs/diagrams'/src.with_suffix('.svg').name).write_text(svg)
    d.find_element('css selector','#out svg').screenshot(str(root/'docs/diagrams'/src.with_suffix('.png').name))
    print(src.name,'exported',flush=True)
 finally:server.shutdown();server.server_close()
