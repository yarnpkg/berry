#!/usr/bin/env bash

set -e

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TEMP_DIR="$(mktemp -d)"

cd "${TEMP_DIR}"

# We want to ensure we're using the latest release
export PATH="${HERE_DIR}/bin:${PATH}"

echo PATH: $PATH
echo Yarn Path: $(which yarn)
echo Yarn Version: $(yarn -v)

# We want to see what fails (if anything fails)
export YARN_ENABLE_INLINE_BUILDS=1

# We want to allow installs to modify the lockfile
export YARN_ENABLE_IMMUTABLE_INSTALLS=0

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
