#!/usr/bin/env bash
# Source this file so PATH applies only to this shell. No root installation.
set -euo pipefail
if [ "${ETALONOPS_NODE_REFRESH:-0}" = 1 ] || ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)'; then
  etalonops_node_version=24.19.0
  case "$(uname -m)" in x86_64) etalonops_node_arch=x64 ;; aarch64) etalonops_node_arch=arm64 ;; *) echo 'Unsupported Node architecture.' >&2; return 1 ;; esac
  etalonops_node_file="node-v${etalonops_node_version}-linux-${etalonops_node_arch}.tar.xz"
  mkdir -p .runtime/node
  curl --fail --silent --show-error --location "https://nodejs.org/dist/v${etalonops_node_version}/${etalonops_node_file}" --output ".runtime/node/${etalonops_node_file}"
  curl --fail --silent --show-error --location "https://nodejs.org/dist/v${etalonops_node_version}/SHASUMS256.txt" --output .runtime/node/SHASUMS256.txt
  python3 - "$etalonops_node_file" <<'PY'
import hashlib,pathlib,sys
root=pathlib.Path('.runtime/node');name=sys.argv[1]
expected=[line.split()[0] for line in (root/'SHASUMS256.txt').read_text().splitlines() if line.split()[-1]==name]
if len(expected)!=1 or hashlib.sha256((root/name).read_bytes()).hexdigest()!=expected[0]: raise SystemExit('Node checksum verification failed; archive was not used.')
print('Official Node archive SHA-256 verified.')
PY
  tar -xJf ".runtime/node/${etalonops_node_file}" -C .runtime/node
  export PATH="$PWD/.runtime/node/node-v${etalonops_node_version}-linux-${etalonops_node_arch}/bin:$PATH"
fi
node --version
