#!/usr/bin/env bash

set -e

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

"$THIS_DIR"/release-tags.sh
"$THIS_DIR"/release-builds.sh
