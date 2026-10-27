#!/usr/bin/env python3
"""Reproducible build: source -> XPI + GitHub Pages update manifest."""
import json,hashlib,pathlib,zipfile,argparse,urllib.parse,sys,re
p=argparse.ArgumentParser();p.add_argument('--base-url',default='https://lordmanuel.github.io/automail/');p.add_argument('--root',default='.');a=p.parse_args();root=pathlib.Path(a.root).resolve();u=urllib.parse.urlparse(a.base_url)
if u.scheme!='https' or not u.netloc.endswith('.github.io') or not u.path.endswith('/') or u.query or u.fragment:sys.exit('Base URL debe ser una URL HTTPS de github.io con / final')
m=json.loads((root/'manifest.json').read_text());g=m['browser_specific_settings']['gecko'];ver=m['version'];g['update_url']=a.base_url+'updates.json';(root/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
site=root/'site';dl=site/'downloads';dl.mkdir(parents=True,exist_ok=True);name=f'correo-calendario-{ver}.xpi';out=dl/name
files=['manifest.json','background.js','contact-manager.js','contact-profile.js','dashboard.html','dashboard.js','defaults.js','email-css.js','photo-db.js','poster.js','style.css']
files += [str(f.relative_to(root)) for folder in ['icons','assets'] for f in sorted((root/folder).rglob('*')) if f.is_file()]
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for fn in files:
  if not (root/fn).is_file():sys.exit(f'Missing source: {fn}')
  info=zipfile.ZipInfo(fn,date_time=(2020,1,1,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  info.external_attr=(0o644 << 16)
  z.writestr(info,(root/fn).read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
h='sha256:'+hashlib.sha256(out.read_bytes()).hexdigest()
updates={'addons':{g['id']:{'updates':[{'version':ver,'update_link':a.base_url+'downloads/'+name,'update_hash':h,'applications':{'gecko':{'strict_min_version':g.get('strict_min_version','153.0')}}}]}}}
(site/'updates.json').write_text(json.dumps(updates,indent=2)+'\n',encoding='utf8');(root/'release-info.json').write_text(json.dumps({'version':ver,'site':a.base_url,'sha256':h},indent=2)+'\n')
print(f'Built {out} {h}')
