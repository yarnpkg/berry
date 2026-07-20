#!/usr/bin/env bash

set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/../.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

"$THIS_DIR"/01-release-tags.sh
"$THIS_DIR"/02-release-builds.sh
