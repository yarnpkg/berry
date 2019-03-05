#!/usr/bin/env bash

set -e

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$THIS_DIR"/local

yarn build:cli
cp "$THIS_DIR"/../packages/berry-cli/bin/berry.js "$THIS_DIR"/local/berry.js

yarn build:plugin-pack
cp "$THIS_DIR"/../packages/plugin-pack/bin/@berry/plugin-pack.js "$THIS_DIR"/local/berry-plugin-pack.js

yarn build:plugin-typescript
cp "$THIS_DIR"/../packages/plugin-typescript/bin/@berry/plugin-typescript.js "$THIS_DIR"/local/berry-plugin-typescript.js
