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

make_build build:cli berry-cli berry.js
make_build build:plugin-exec plugin-exec @berry/plugin-exec.js
make_build build:plugin-stage plugin-stage @berry/plugin-stage.js
make_build build:plugin-typescript plugin-typescript @berry/plugin-typescript.js
make_build build:plugin-workspace-tools plugin-workspace-tools @berry/plugin-workspace-tools.js
