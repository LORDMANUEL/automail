#!/usr/bin/env python3
import json,hashlib,pathlib,zipfile,sys,urllib.parse
s=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'site');data=json.loads((s/'updates.json').read_text());assert len(data['addons'])==1
for addon,meta in data['addons'].items():
 for item in meta['updates']:
  p=urllib.parse.urlparse(item['update_link']);assert p.scheme=='https' and p.netloc.endswith('github.io');f=s/'downloads'/pathlib.PurePosixPath(p.path).name
  assert f.is_file(); assert 'sha256:'+hashlib.sha256(f.read_bytes()).hexdigest()==item['update_hash']
  with zipfile.ZipFile(f) as z:
   assert z.testzip() is None
   x=json.loads(z.read('manifest.json'));g=x['browser_specific_settings']['gecko']
   assert x['version']==item['version'] and g['id']==addon and g['update_url']==item['update_link'].rsplit('/downloads/',1)[0]+'/updates.json'
   assert not any(n.startswith('tests/') or n.startswith('tools/') or n.startswith('docs/') for n in z.namelist())
print('PASS: XPI integral, manifest ID/version, update URL, SHA256, only runtime files')
