#!/usr/bin/env python3
import pathlib,subprocess,sys
r=pathlib.Path(__file__).resolve().parents[1]
cases=['test-v072-stress-100.js','test-v071-upgrade.js','test-v071-send-review.js','test-v061-list-members.js','test-v060-background.js','test-v060-vcard.js','test-v057-large-card.js','test-photo-db-v055.js']
for js in r.glob('*.js'): subprocess.run(['node','--check',str(js)],check=True)
for t in cases:
 subprocess.run(['node',str(r/'tests'/t)],cwd=r,check=True)
subprocess.run([sys.executable,str(r/'tools'/'verify_release.py'),str(r/'site')],cwd=r,check=True)
print('QA PASS V0.7.2: 100 scheduled, 3 simulated restarts, concurrent storage writes, legacy tests, release digest')
