#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p .runtime
if ! flock -n .runtime/import.lock true; then
  echo 'The strut import is already running. Run status.sh to see progress.'
  exit 0
fi
nohup bash run-import.sh --apply --approve-images > .runtime/run.log 2>&1 < /dev/null &
printf '%s\n' "$!" > .runtime/job.pid
echo "Strut import started in Cloud Shell (PID $!)."
echo "Progress log: $PWD/.runtime/run.log"
echo "Check progress: bash '$PWD/status.sh'"
