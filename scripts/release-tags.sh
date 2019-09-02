#!/usr/bin/env bash

set -e

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

# Bump the packages, and store which ones have been bumped (and thus need to be re-released)
RELEASE_DETAILS=$(node "$REPO_DIR"/scripts/run-yarn.js version apply --all --json)
RELEASE_SIZE=$(wc -l <<< "$RELEASE_DETAILS")

if [[ $RELEASE_SIZE -eq 0 ]]; then
  echo "No package to release"
  exit 1
elif [[ $RELEASE_SIZE -eq 1 ]]; then
  COMMIT_MESSAGE="Releasing one new package"
else
  COMMIT_MESSAGE="Releasing ${RELEASE_SIZE} new packages"
fi

NL=$'\n'

COMMIT_MESSAGE="$COMMIT_MESSAGE$NL$NL| Package name | Version |$NL"
COMMIT_MESSAGE="$COMMIT_MESSAGE| --- | --- |$NL"

while read line; do
  IDENT=$(jq -r .ident <<< "$line")
  VERSION=$(jq -r .newVersion <<< "$line")

  COMMIT_MESSAGE="$COMMIT_MESSAGE| \`$IDENT\` | \`$VERSION\` |$NL"
done <<< "$RELEASE_DETAILS"

git add "$REPO_DIR"
git commit -m "$COMMIT_MESSAGE"

while read line; do
  IDENT=$(jq -r .ident <<< "$line")
  VERSION=$(jq -r .newVersion <<< "$line")
  TAG="$IDENT/$VERSION"

  if ! [[ -z $(git tag -l "$TAG") ]]; then
    git tag --delete "$TAG"
  fi

  git tag -a "$TAG" -m "$IDENT"
done <<< "$RELEASE_DETAILS"

