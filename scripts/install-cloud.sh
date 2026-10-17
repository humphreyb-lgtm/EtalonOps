#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /workspace/EtalonOps
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run build
npm run build:preview
npm run test:server
npm run sql:prepare
npm run test:sql
python -m venv /workspace/.venvs/etalonops-azure
/workspace/.venvs/etalonops-azure/bin/python -m pip install --cache-dir /workspace/.cache/pip --requirement tools/azure-cli-requirements.txt
/workspace/.venvs/etalonops-azure/bin/python -m pip check
mkdir -p /workspace/.credentials/etalonops-azure
chmod 700 /workspace/.credentials/etalonops-azure
AZURE_CONFIG_DIR=/workspace/.credentials/etalonops-azure AZURE_CORE_COLLECT_TELEMETRY=false /workspace/.venvs/etalonops-azure/bin/az version --output json
