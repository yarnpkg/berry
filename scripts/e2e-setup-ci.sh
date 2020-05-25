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

# Otherwise git commit doesn't work, and some tools require it
git config --global user.email "you@example.com"
git config --global user.name "John Doe"

# We want all e2e tests to fail on unhandled rejections
export NODE_OPTIONS="--unhandled-rejections=strict"
