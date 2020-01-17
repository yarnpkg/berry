#!/usr/bin/env bash

set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/../.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
mkdir "$TEMP_DIR"/bin

cp "$THIS_DIR"/package.json.template "$TEMP_DIR"/package.json
cp "$REPO_DIR"/packages/yarnpkg-cli/bin/yarn.js "$TEMP_DIR"/bin/yarn.js

chmod +x "$TEMP_DIR"/bin/yarn.js

cd "$TEMP_DIR"

node "$TEMP_DIR"/bin/yarn.js
node "$TEMP_DIR"/bin/yarn.js npm publish --tag=berry
