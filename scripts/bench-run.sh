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
}

case $PACKAGE_MANAGER in
  classic)
    bench install-full-cold \
      --prepare 'rm -rf node_modules yarn.lock && yarn cache clean' \
      'yarn install'
    bench install-cache-only \
      --prepare 'rm -rf node_modules yarn.lock' \
      'yarn install'
    bench install-cache-and-lock \
      --prepare 'rm -rf node_modules' \
      'yarn install'
    # Note that Classic has a bailout when nothing changed at all. Since
    # we want to benchmark the time it takes to run an install when there
    # is very few I/O (for example during a `remove` operation), we need
    # to bypass this bailout. We do this by simply touching the manifest.
    bench install-ready \
      --prepare 'touch package.json' \
      'yarn install'
    ;;
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
    # Note that Pnpm has a bailout when nothing changed at all. Since
    # we want to benchmark the time it takes to run an install when there
    # is very few I/O (for example during a `remove` operation), we need
    # to bypass this bailout. We do this by running a remove operation on
    # a package that isn't in the tree; this causes a "bug" in Pnpm that
    # thinks a package got removed.
    #
    # Zoltan, if you see this and fix this bug: can you also add an option
    # to skip the bailout? 😁
    bench install-ready \
      'pnpm remove doesnt-exist' \
      'pnpm install'
    ;;
  *)
    echo "Invalid package manager ${$1}"
    return 1;;
esac
