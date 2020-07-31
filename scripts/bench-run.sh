#!/usr/bin/env bash

set -e

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TEMP_DIR="$(mktemp -d)"

cd "${TEMP_DIR}"

# Otherwise git commit doesn't work, and some tools require it
git config --global user.email "you@example.com"
git config --global user.name "John Doe"

prepare_yarn() {
  (cd "$HERE_DIR" && node ./run-yarn.js build:cli --no-minify)
  echo "yarnPath: '${HERE_DIR}/../packages/yarnpkg-cli/bundles/yarn.js'" >> .yarnrc.yml
}

bench() {
  PACKAGE_MANAGER=$1; shift
  TEST_NAME=$2; shift
  hyperfine --show-output --min-runs=5 "$@"
}

cp "$HERE_DIR"/benchmarks/"$2".json package.json

case $1 in
  yarn)
    prepare_yarn
    bench yarn install-full-cold \
      --warmup 1 \
      --prepare 'rm -rf .yarn .pnp.* yarn.lock && yarn cache clean --all' \
      'yarn install'
    ;;
  yarn-nm)
    prepare_yarn
    bench yarn-nm install-full-cold \
      --warmup 1 \
      --prepare 'rm -rf .yarn node_modules yarn.lock && yarn cache clean --all' \
      'YARN_NODE_LINKER=node-modules yarn install'
    ;;
  npm)
    npm install -g npm
    bench npm install-full-cold \
      --warmup 1 \
      --prepare 'rm -rf node_modules package-lock.json && npm cache clean --force' \
      'npm install'
    ;;
  pnpm)
    npm install -g pnpm
    bench pnpm install-full-cold \
      --warmup 1 \
      --prepare 'rm -rf node_modules ~/.pnpm-store pnpm-lock.yaml' \
      'pnpm install'
    ;;
  *)
    echo "Invalid package manager ${$1}"
    return 1;;
esac
