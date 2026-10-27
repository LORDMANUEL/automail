#!/usr/bin/env python3
"""Valida una exportación estática de Next.js y publica descargas solo cuando existen."""
from pathlib import Path
import argparse
import json
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'_site'
EXPORT=ROOT/'web'/'out'
DOCS=ROOT/'docs'
ADDON_ID='correo-calendario@local.addon'

def run(*args):
    subprocess.run(args,cwd=ROOT,check=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--require-package',action='store_true')
    args=parser.parse_args()
    if not (EXPORT/'index.html').is_file():
        sys.exit('Falta web/out/index.html: compila Next.js primero')
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(EXPORT,OUT)
    (OUT/'.nojekyll').touch()
    if not (OUT/'_next').is_dir():
        sys.exit('Falta _next: exportación incompleta')
    for name in ('paso-1.svg','paso-2.svg','paso-3.svg'):
        if not (OUT/'previews'/name).is_file():
            sys.exit('Falta recurso visual '+name)
    if DOCS.is_dir():
        dest=OUT/'documentacion'
        dest.mkdir(exist_ok=True)
        for file in DOCS.glob('*.md'):
            shutil.copyfile(file,dest/file.name)
    complete=all((ROOT/p).is_file() for p in (
        'manifest.json','background.js','dashboard.js',
        'tools/package_release.py','tools/verify_release.py','tools/qa_v070.py'))
    if not complete:
        if args.require_package:
            sys.exit('Código XPI completo todavía no está en GitHub.')
        print('::warning::XPI pendiente de publicación, se desactiva la actualización pública.')
        (OUT/'updates.json').write_text(json.dumps(
            {'addons':{ADDON_ID:{'updates':[]}}},indent=2)+'\n',encoding='utf8')
        print('NEXT.JS EXPORT VALIDADO; XPI NO PUBLICADO')
        return
    run(sys.executable,'tools/package_release.py','--base-url','https://lordmanuel.github.io/automail/')
    run(sys.executable,'tools/qa_v070.py')
    run(sys.executable,'tools/verify_release.py','site')
    shutil.copyfile(ROOT/'site'/'updates.json',OUT/'updates.json')
    if (ROOT/'site'/'downloads').is_dir():
        shutil.copytree(ROOT/'site'/'downloads',OUT/'downloads',dirs_exist_ok=True)
    m=json.loads((ROOT/'manifest.json').read_text(encoding='utf8'))
    u=json.loads((OUT/'updates.json').read_text(encoding='utf8'))
    update=u['addons'][m['browser_specific_settings']['gecko']['id']]['updates'][0]
    assert update['version']==m['version']
    assert (OUT/'downloads'/('correo-calendario-'+m['version']+'.xpi')).is_file()
    print('NEXT.JS EXPORT Y XPI VALIDADOS')

if __name__=='__main__':
    main()
