#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
python3 - <<'PY'
import json,pathlib,os
p=pathlib.Path('.runtime/result.json')
if p.exists():
 r=json.loads(p.read_text())
 print('State:',r.get('state'))
 print('Material batches:',len(r.get('batches',[])),'/ 6')
 print('Materials verified:',r.get('catalogRowsVerified','Not finished'),'/ 297')
 print('Active catalog materials:',r.get('activeMaterials','Not finished'))
 print('Images:',r.get('images',{}))
 print('Error:',r.get('error','None'))
else:print('Starting or validating. The report appears after the live preflight.')
pid=pathlib.Path('.runtime/job.pid')
if pid.exists():
 try:
  value=int(pid.read_text());os.kill(value,0)
  command=pathlib.Path('/proc')/str(value)/'cmdline'
  print('Cloud Shell job is running.' if command.exists() and b'run-import.sh' in command.read_bytes() else 'The recorded job has exited; check the final state and log.')
 except ProcessLookupError:print('Cloud Shell job has exited; check the final state and log.')
PY
if [[ -f .runtime/run.log ]]; then tail -n 8 .runtime/run.log; fi
