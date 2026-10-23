#!/usr/bin/env bash
set -euo pipefail
umask 077
search_download_base=${1:?Supply the immutable EtalonOps download URL.}
search_archive='/tmp/EtalonOps-Strut-Filters-v49.3.zip'
search_directory="$HOME/EtalonOps-Strut-Filters-v49.3"
az account set --subscription a428f249-9b2a-4314-8619-6b3fd33c805e
if [[ ! -e "$search_directory" && ! -L "$search_directory" && -d "$HOME/clouddrive" ]]; then
  mkdir -p "$HOME/clouddrive/EtalonOps-Strut-Filters-v49.3"
  ln -s "$HOME/clouddrive/EtalonOps-Strut-Filters-v49.3" "$search_directory"
fi
mkdir -p "$search_directory/.runtime"
exec 8>"$search_directory/.runtime/install.lock"
flock -n 8 || { echo 'Another search installer is already starting. Check status.sh shortly.'; exit 0; }
if ! flock -n "$search_directory/.runtime/import.lock" true; then
  echo 'The search update is already running.'
  bash "$search_directory/status.sh"
  exit 0
fi
curl -fsSL --retry 3 --max-time 180 "$search_download_base/EtalonOps-Strut-Filters-v49.3.zip" -o "$search_archive"
printf '%s  %s\n' 'b3b70979c5aed6196c8dd0d4937428b2e8fa765466b96711cd0859d5d0d0a3c1' "$search_archive" | sha256sum --check -
unzip -oq "$search_archive" -d "$search_directory"
bash "$search_directory/start-import.sh" 8>&-
