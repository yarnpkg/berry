#!/usr/bin/env bash

set -e

PACKAGE_MANAGER=$1; shift
TEST_NAME=$1; shift
BENCH_DIR=$1; shift

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

cd "$BENCH_DIR"

bench() {
  SUBTEST_NAME=$1; shift
  echo "Testing $SUBTEST_NAME"
  hyperfine ${HYPERFINE_OPTIONS:-} --export-json=bench-$SUBTEST_NAME.json --min-runs=10 --warmup=1 "$@"
}

cp "$HERE_DIR"/benchmarks/"$TEST_NAME".json package.json

mkdir dummy-pkg
echo '{"name": "dummy-pkg", "version": "0.0.0"}' > dummy-pkg/package.json

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
    "enableImmutableInstalls: false"
}

setup-yarn2-nm() {
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "nodeLinker: node-modules"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "nmMode: hardlinks-local"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "enableGlobalCache: true"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "compressionLevel: 0"
}

setup-yarn2-pnpm() {
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "nodeLinker: pnpm"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "enableGlobalCache: true"
  >> "$BENCH_DIR/.yarnrc.yml" echo \
    "compressionLevel: 0"
}

setup-pnpm() {
  >> "$BENCH_DIR/.npmrc" echo \
    "strict-peer-dependencies=false"
  >> "$BENCH_DIR/pnpm-workspace.yaml" echo \
    "dangerouslyAllowAllBuilds: true"
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
    bench install-ready \
      --prepare 'yarn remove dummy-pkg || true' \
      'yarn add dummy-pkg@link:./dummy-pkg'
    ;;
  yarn)
    setup-yarn2
    bench install-full-cold \
      --prepare 'rm -rf .yarn .pnp.* yarn.lock .yarn-global' \
      'yarn install'
    bench install-cache-only \
      --prepare 'rm -rf .yarn .pnp.* yarn.lock' \
      'yarn install'
    bench install-cache-and-lock \
      --prepare 'rm -rf .yarn .pnp.*' \
      'yarn install'
    bench install-ready \
      --prepare 'yarn remove dummy-pkg || true' \
      'yarn add dummy-pkg@link:./dummy-pkg'
    ;;
  yarn-nm)
    setup-yarn2
    setup-yarn2-nm
    bench install-full-cold \
      --prepare 'rm -rf .yarn node_modules yarn.lock .yarn-global' \
      'yarn install'
    bench install-cache-only \
      --prepare 'rm -rf .yarn node_modules yarn.lock' \
      'yarn install'
    bench install-cache-and-lock \
      --prepare 'rm -rf .yarn node_modules' \
      'yarn install'
    bench install-ready \
      --prepare 'yarn remove dummy-pkg || true' \
      'yarn add dummy-pkg@link:./dummy-pkg'
    ;;
  yarn-pnpm)
    setup-yarn2
    setup-yarn2-pnpm
    bench install-full-cold \
      --prepare 'rm -rf .yarn node_modules yarn.lock .yarn-global' \
      'yarn install'
    bench install-cache-only \
      --prepare 'rm -rf .yarn node_modules yarn.lock' \
      'yarn install'
    bench install-cache-and-lock \
      --prepare 'rm -rf .yarn node_modules' \
      'yarn install'
    bench install-ready \
      --prepare 'yarn remove dummy-pkg || true' \
      'yarn add dummy-pkg@link:./dummy-pkg'
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
      --prepare 'npm remove dummy-pkg || true' \
      'npm add dummy-pkg@file:./dummy-pkg'
    ;;
  pnpm)
    setup-pnpm
    bench install-full-cold \
      --prepare 'rm -rf node_modules pnpm-lock.yaml ~/.local/share/pnpm/store ~/.cache/pnpm' \
      'pnpm install'
    bench install-cache-only \
      --prepare 'rm -rf node_modules pnpm-lock.yaml' \
      'pnpm install'
    bench install-cache-and-lock \
      --prepare 'rm -rf node_modules' \
      'pnpm install'
    bench install-ready \
      --prepare 'pnpm remove dummy-pkg || true' \
      'pnpm add dummy-pkg@link:./dummy-pkg'
    ;;
  *)
    echo "Invalid package manager ${$1}"
    return 1;;
esac
