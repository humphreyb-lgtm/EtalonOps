#!/usr/bin/env bash
set -euo pipefail
umask 077
import_download_base=${1:?Supply the immutable EtalonOps download URL.}
import_archive='/tmp/EtalonOps-Strut-Cloud-Import.zip'
import_directory="$HOME/EtalonOps-Strut-Cloud-Import"
az account set --subscription a428f249-9b2a-4314-8619-6b3fd33c805e
if [[ ! -e "$import_directory" && ! -L "$import_directory" && -d "$HOME/clouddrive" ]]; then
  mkdir -p "$HOME/clouddrive/EtalonOps-Strut-Cloud-Import"
  ln -s "$HOME/clouddrive/EtalonOps-Strut-Cloud-Import" "$import_directory"
fi
mkdir -p "$import_directory/.runtime"
exec 8>"$import_directory/.runtime/install.lock"
flock -n 8 || { echo 'Another strut installer is already starting. Try status.sh shortly.'; exit 0; }
if ! flock -n "$import_directory/.runtime/import.lock" true; then
  echo 'The strut import is already running.'
  bash "$import_directory/status.sh"
  exit 0
fi
curl -fsSL --retry 3 --max-time 180 "$import_download_base/EtalonOps-Strut-Cloud-Import.zip" -o "$import_archive"
printf '%s  %s\n' '95a80f6c7af0e07b6181206a8e15aaaba08da3c33a738f15a286291f2a492b65' "$import_archive" | sha256sum --check -
unzip -oq "$import_archive" -d "$import_directory"
bash "$import_directory/start-import.sh" 8>&-
