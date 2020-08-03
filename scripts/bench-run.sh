#!/usr/bin/env bash

set -e

PACKAGE_MANAGER=$1; shift
TEST_NAME=$1; shift
BENCH_DIR=$1; shift

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

cd "$BENCH_DIR"

bench() {
  SUBTEST_NAME=$1; shift
  hyperfine --export-json=bench-$SUBTEST_NAME.json --min-runs=10 --warmup=1 "$@"
}

cp "$HERE_DIR"/benchmarks/"$TEST_NAME".json package.json

touch a
  if cp --reflink a b >& /dev/null; then
  echo "Reflinks are supported"
else
  echo "Reflink aren't supported! Installs may be quite slower than necessary"
fi

setup-yarn2() {
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "globalFolder: '${BENCH_DIR}/.yarn-global'"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "yarnPath: '${HERE_DIR}/../packages/yarnpkg-cli/bundles/yarn.js'"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "enableScripts: false"
}

case $PACKAGE_MANAGER in
  yarn)
    setup-yarn2
    bench install-full-cold \
      --prepare 'rm -rf .yarn .pnp.* yarn.lock && yarn cache clean --all' \
      'yarn install'
    bench install-cache-only \
      --prepare 'rm -rf .yarn .pnp.* yarn.lock' \
      'yarn install'
    bench install-cache-and-lock \
      --prepare 'rm -rf .yarn .pnp.*' \
      'yarn install'
    bench install-ready \
      'yarn install'
    ;;
  yarn-nm)
    setup-yarn2
    bench install-full-cold \
      --prepare 'rm -rf .yarn node_modules yarn.lock && yarn cache clean --all' \
      'YARN_NODE_LINKER=node-modules yarn install'
    bench install-cache-only \
      --prepare 'rm -rf .yarn node_modules yarn.lock' \
      'YARN_NODE_LINKER=node-modules yarn install'
    bench install-cache-and-lock \
      --prepare 'rm -rf .yarn node_modules' \
      'YARN_NODE_LINKER=node-modules yarn install'
    bench install-ready \
      'YARN_NODE_LINKER=node-modules yarn install'
    ;;
  npm)
    bench install-full-cold \
      --prepare 'rm -rf node_modules package-lock.json && npm cache clean --force' \
      'npm install --ignore-scripts'
    bench install-cache-only \
      --prepare 'rm -rf node_modules package-lock.json' \
      'npm install --ignore-scripts'
    bench install-cache-and-lock \
      --prepare 'rm -rf node_modules' \
      'npm install --ignore-scripts'
    bench install-ready \
      'npm install --ignore-scripts'
    ;;
  pnpm)
    bench install-full-cold \
      --prepare 'rm -rf node_modules pnpm-lock.yaml ~/.pnpm-store' \
      'pnpm install --ignore-scripts'
    bench install-cache-only \
      --prepare 'rm -rf node_modules pnpm-lock.yaml' \
      'pnpm install --ignore-scripts'
    bench install-cache-and-lock \
      --prepare 'rm -rf node_modules' \
      'pnpm install --ignore-scripts'
    bench install-ready \
      'pnpm install --ignore-scripts'
    ;;
  *)
    echo "Invalid package manager ${$1}"
    return 1;;
esac
