#!/usr/bin/env bash

set -e

# We want to see what fails (if anything fails)
export YARN_ENABLE_INLINE_BUILDS=1

HERE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TEMP_DIR="$(mktemp -d)"

cd "${TEMP_DIR}"
echo "yarnPath: '${HERE_DIR}/../run-yarn.js'" > .yarnrc.yml

bash -e "${HERE_DIR}"/"${1}".sh
