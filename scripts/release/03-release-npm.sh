#!/usr/bin/env bash

set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/../.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

VERSION=$(YARN_IGNORE_PATH=1 node packages/yarnpkg-cli/bin/yarn.js --version)

TEMP_DIR="$(mktemp -d)"
mkdir "$TEMP_DIR"/bin

jq > "$TEMP_DIR"/package.json \
  '{name: "@yarnpkg/cli-dist", version: "'"$VERSION"'", "bin": {"yarn": "bin/yarn.js", "yarnpkg": "bin/yarn.js"}} + (. | {license,repository,engines})' \
  "$REPO_DIR"/packages/yarnpkg-cli/package.json

cp "$REPO_DIR"/packages/yarnpkg-cli/bin/yarn.js "$TEMP_DIR"/bin/yarn.js
chmod +x "$TEMP_DIR"/bin/yarn.js

cd "$TEMP_DIR"

node "$TEMP_DIR"/bin/yarn.js
node "$TEMP_DIR"/bin/yarn.js npm publish --access=public
