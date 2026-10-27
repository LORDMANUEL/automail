#!/usr/bin/env python3
"""Construye un sitio publicable, sin anunciar binarios inexistentes."""
from __future__ import annotations
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT = ROOT / "_site"

class LocalRefs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("src", "href"):
            url = attrs.get(key, "")
            if url and not url.startswith(("#", "http:", "https:", "mailto:", "data:", "javascript:")):
                self.refs.append(url.split("#", 1)[0].split("?", 1)[0])

def run(*argv):
    subprocess.run(argv, cwd=ROOT, check=True)

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--require-package", action="store_true")
    args = p.parse_args()
    if not (DOCS / "index.html").is_file():
        sys.exit("ERROR: No existe docs/index.html")
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(DOCS, OUT)
    (OUT / ".nojekyll").touch()
    html = (OUT / "index.html").read_text(encoding="utf-8")
    refs = LocalRefs()
    refs.feed(html)
    missing = [ref for ref in refs.refs if not (OUT / ref).is_file()]
    if missing:
        sys.exit(f"ERROR: Referencias locales ausentes en el sitio: {missing}")
    complete = all((ROOT / f).is_file() for f in ("manifest.json", "background.js", "dashboard.js", "tools/package_release.py", "tools/verify_release.py", "tools/qa_v070.py"))
    if not complete:
        if args.require_package:
            sys.exit("ERROR: Las fuentes del XPI no están en GitHub. Publica primero el paquete de código completo.")
        print("::warning::Sitio listo, pero el repositorio aún no contiene el código completo del XPI; no se ofrece descarga ni manifiesto de actualización válido.")
        (OUT / "updates.json").write_text(json.dumps({"addons": {"correo-calendario@local.addon": {"updates": []}}}, indent=2)+"\n", encoding="utf-8")
        print("SITIO WEB VALIDADO (SIN BINARIO)")
        return
    run(sys.executable, "tools/package_release.py", "--base-url", "https://lordmanuel.github.io/automail/")
    run(sys.executable, "tools/qa_v070.py")
    run(sys.executable, "tools/verify_release.py", "site")
    shutil.copy2(ROOT / "site" / "updates.json", OUT / "updates.json")
    downloads = ROOT / "site" / "downloads"
    if downloads.exists():
        shutil.copytree(downloads, OUT / "downloads", dirs_exist_ok=True)
    m = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    u = json.loads((OUT / "updates.json").read_text(encoding="utf-8"))
    record = u["addons"][m["browser_specific_settings"]["gecko"]["id"]]["updates"][0]
    assert record["version"] == m["version"]
    assert (OUT / "downloads" / f"correo-calendario-{m['version']}.xpi").is_file()
    print("SITIO, XPI Y CANAL DE ACTUALIZACIONES VALIDADOS")

if __name__ == "__main__":
    main()
