#!/usr/bin/env bash

set -e

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TEMP_DIR="$(mktemp -d)"

cd "${TEMP_DIR}"

# We want to ensure we're using the latest release
ROOT_DIR="$(dirname ${HERE_DIR})"
export PATH="${ROOT_DIR}/packages/yarnpkg-cli/bundles:${PATH}"
cp "$ROOT_DIR/packages/yarnpkg-cli/bundles/yarn.js" "$ROOT_DIR/packages/yarnpkg-cli/bundles/yarn"
cp "$ROOT_DIR/packages/yarnpkg-cli/bundles/yarn.js" "$ROOT_DIR/packages/yarnpkg-cli/bundles/yarnpkg"
chmod +x "$ROOT_DIR/packages/yarnpkg-cli/bundles/yarn"
chmod +x "$ROOT_DIR/packages/yarnpkg-cli/bundles/yarnpkg"

echo PATH: $PATH
echo Yarn Path: $(which yarn)
echo Yarn Version: $(yarn -v)

# We want to see what fails (if anything fails)
export YARN_ENABLE_INLINE_BUILDS=1

# We want to allow installs to modify the lockfile
export YARN_ENABLE_IMMUTABLE_INSTALLS=0

# We want to make sure the projects work in a monorepo
export YARN_PNP_FALLBACK_MODE=none

# TODO: Remove when either of these issues are fixed
# - https://github.com/nodejs/node/issues/39140
# - https://github.com/nodejs/node/issues/37782
# - https://github.com/facebook/jest/issues/12060
# Due to a bug in `jest-worker` and/or Node.js adding a loader
# causes our e2e tests to time out so require the tests that needs it
# to explicitly enable it
export YARN_PNP_ENABLE_ESM_LOADER=false

# Otherwise git commit doesn't work, and some tools require it
git config --global user.email "you@example.com"
git config --global user.name "John Doe"

# We want all e2e tests to fail on unhandled rejections
export NODE_OPTIONS="--unhandled-rejections=strict"

if [[ "$1" == "nm" ]]; then
  NODE_LINKER="node-modules"
elif [[ -z "$1" || "$1" == "pnp" ]]; then
  NODE_LINKER="pnp"
else
  echo "Invalid nodeLinker: $1"
  exit 1
fi

yarn config set -H nodeLinker "$NODE_LINKER"

echo nodeLinker: $NODE_LINKER
