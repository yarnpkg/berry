#!/usr/bin/env bash

set -e

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TEMP_DIR="$(mktemp -d)"

cd "${TEMP_DIR}"

bench() {
  SUBTEST_NAME=$1; shift
  hyperfine --show-output --export-json=bench-$SUBTEST_NAME.json --min-runs=10 --warmup=1 "$@"
}

PACKAGE_MANAGER=$1; shift
TEST_NAME=$1; shift

cp "$HERE_DIR"/benchmarks/"$TEST_NAME".json package.json

touch a
  if cp --reflink a b >& /dev/null; then
  echo "Reflinks are supported"
else
  echo "Reflink aren't supported! Installs may be quite slower than necessary"
fi

setup-yarn2() {
  >> "$TEMP_DIR/.yarnrc.yml" echo \
    "globalFolder: '${TEMP_DIR}/.yarn-global'"
  >> "$TEMP_DIR/.yarnrc.yml" echo \
    "yarnPath: '${HERE_DIR}/../packages/yarnpkg-cli/bundles/yarn.js'"
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
      'npm install'
    bench install-cache-only \
      --prepare 'rm -rf node_modules package-lock.json' \
      'npm install'
    bench install-cache-and-lock \
      --prepare 'rm -rf node_modules' \
      'npm install'
    bench install-ready \
      'npm install'
    ;;
  pnpm)
    bench install-full-cold \
      --prepare 'rm -rf node_modules pnpm-lock.yaml ~/.pnpm-store' \
      'pnpm install'
    bench install-cache-only \
      --prepare 'rm -rf node_modules pnpm-lock.yaml' \
      'pnpm install'
    bench install-cache-and-lock \
      --prepare 'rm -rf node_modules' \
      'pnpm install'
    bench install-ready \
      'pnpm install'
    ;;
  *)
    echo "Invalid package manager ${$1}"
    return 1;;
esac

(cd "$HERE_DIR" && yarn node ./submit-bench-data.js "$PACKAGE_MANAGER" "$TEST_NAME" "$TEMP_DIR")
