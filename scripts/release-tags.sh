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

UPDATE_ARGUMENTS=()

while read line; do
  echo $line

  IDENT=$(jq -r .ident <<< "$line")
  VERSION=$(jq -r .newVersion <<< "$line")

  COMMIT_MESSAGE="$COMMIT_MESSAGE| \`$IDENT\` | \`$VERSION\` |$NL"
  UPDATE_ARGUMENTS+=(--include "$IDENT")

  yarn workspace "$IDENT" pack --dry-run >& /dev/null || (
    echo "Couldn't run prepack on $IDENT"
    exit 1
  )
done <<< "$RELEASE_DETAILS"

# Regenerate the local versions for the elements that get released
YARN_NPM_PUBLISH_REGISTRY=https://npm.pkg.github.com yarn workspaces foreach \
  --verbose --topological --no-private "${UPDATE_ARGUMENTS[@]}" \
  run update-local

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

BASE_TAG=$(date +%Y-%m-%d)
for TAG_SUFFIX in '' {a..z}; do
    TAG="$BASE_TAG$TAG_SUFFIX"

    if ! [[ -z $(git tag -l "$TAG") ]]; then
        if git merge-base --is-ancestor tags/"$TAG" HEAD; then
            continue
        else
            git tag --delete "$TAG"
        fi
    fi

    git tag -a "$TAG" -m "$TAG"
    break
done

printf "%s" "$COMMIT_MESSAGE"
