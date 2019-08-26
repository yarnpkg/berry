#!/usr/bin/env bash

set -e

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/.."

ARTIFACT_DIR="$REPO_DIR"/artifacts

rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

contains_element() {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
  return 1
}

build_cli() {
  if contains_element @yarnpkg/cli "${PACKAGES_TO_RELEASE[@]}"; then
    node "$REPO_DIR"/scripts/run-yarn.js build:cli
    CLI_VERSION=$(node "$REPO_DIR"/scripts/run-yarn.js --version)
    cp "$REPO_DIR"/packages/yarnpkg-cli/bundles/yarn.js "$ARTIFACT_DIR"/yarn-"$CLI_VERSION".js
  fi
}

build_plugin() {
  if contains_element @yarnpkg/"$1" "${PACKAGES_TO_RELEASE[@]}"; then
    node "$REPO_DIR"/scripts/run-yarn.js build:"$1"
    PLUGIN_VERSION=$(jq -r .version packages/$1/package.json)
    cp "$REPO_DIR"/packages/"$1"/bundles/@yarnpkg/"$1".js "$ARTIFACT_DIR"/"$1"-"$PLUGIN_VERSION".js
  fi
}

build_package() {
  if contains_element @yarnpkg/"$1" "${PACKAGES_TO_RELEASE[@]}"; then
    node "$REPO_DIR"/scripts/run-yarn.js packages/yarn-"$1" pack -o "$ARTIFACT_DIR"/"%s-%v.tgz"
  fi
}

# Bump the packages, and store which ones have been bumped (and thus need to be re-released)
PACKAGES_TO_RELEASE=( $(node "$REPO_DIR"/scripts/run-yarn.js version apply --all --json | jq -r .ident) )

# Don't forget to update the lockfile to apply the new versions
node "$REPO_DIR"/scripts/run-yarn.js install

build_cli

build_plugin plugin-exec
build_plugin plugin-stage
build_plugin plugin-typescript
build_plugin plugin-workspace-tools

build_package builder
build_package cli
build_package core
build_package fslib
build_package json-proxy
build_package libzip
build_package parsers
build_package pnp
build_package pnpify
build_package shell
