#!/usr/bin/env bash

set -e

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)

ARTIFACT_DIR="$THIS_DIR"/../artifacts
mkdir -p "$ARTIFACT_DIR"

yarn build:cli
CLI_VERSION=$(yarn --version)

cp packages/berry-cli/bundles/berry.js "$ARTIFACT_DIR"/yarn-"$CLI_VERSION".js
