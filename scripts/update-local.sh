#!/usr/bin/env bash

set -e

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$THIS_DIR"/local

make_build() {
  yarn "$1"

  local src="$THIS_DIR"/../packages/"$2"/bundles/"$3"
  local dest="$THIS_DIR"/../packages/"$2"/bin/"$3"

  mkdir -p $(dirname "$dest")
  cp "$src" "$dest"
}

make_build build:cli yarnpkg-cli yarn.js
echo
make_build build:plugin-exec plugin-exec @yarnpkg/plugin-exec.js
echo
make_build build:plugin-stage plugin-stage @yarnpkg/plugin-stage.js
echo
make_build build:plugin-version plugin-version @yarnpkg/plugin-version.js
echo
make_build build:plugin-typescript plugin-typescript @yarnpkg/plugin-typescript.js
echo
make_build build:plugin-workspace-tools plugin-workspace-tools @yarnpkg/plugin-workspace-tools.js
