#!/usr/bin/env bash

RELEASE_ARGUMENTS=()

release_package() {
  git describe --match "$1/*" HEAD | while read tag; do
    IDENT=$(git tag -l --format='%(contents)' "$tag")
    RELEASE_ARGUMENTS+=(--include "$1")
  done
}

yarn workspaces foreach \
  --topological "${RELEASE_ARGUMENTS[@]}" \
  npm publish --tolerate-republish
