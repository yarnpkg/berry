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
  NAME=$1; shift
  hyperfine --show-output "$@"
}

cp "$HERE_DIR"/benchmarks/"$2".json package.json

case $1 in
  yarn)
    prepare_yarn
    bench install-full-cold --min-runs=5 -p 'rm -rf .yarn .pnp.* && yarn cache clean --all' 'yarn install'
    ;;
  yarn-nm)
    prepare_yarn
    bench install-full-cold --min-runs=5 -p 'rm -rf .yarn node_modules && yarn cache clean --all' 'YARN_NODE_LINKER=node-modules yarn install'
    ;;
  npm)
    npm install -g npm
    bench install-full-cold --min-runs=5 -p 'rm -rf node_modules && npm cache clean --force' 'npm ci'
    ;;
  pnpm)
    npm install -g pnpm
    bench install-full-cold --min-runs=5 -p 'rm -rf node_modules ~/.pnpm-store' 'pnpm install'
    ;;
  *)
    echo "Invalid package manager ${$1}"
    return 1;;
esac
