#!/usr/bin/env bash

set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/../.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

CURRENT_COMMIT=$(git rev-parse HEAD)

PRERELEASE=0
APPLY_OPTIONS=()

OPTIND=1
for arg in "$@"; do
  case $1 in
    --prerelease)
      APPLY_OPTIONS+=(--prerelease)
      PRERELEASE=1
      ;;
  esac
done


# Bump the packages, and store which ones have been bumped (and thus need to be re-released)
RELEASE_DETAILS=$(node "$REPO_DIR"/scripts/run-yarn.js version apply --all --json "${APPLY_OPTIONS}")
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
    echo "Couldn't run prepack on $IDENT:"
    yarn workspace "$IDENT" pack --dry-run
    exit 1
  )
done <<< "$RELEASE_DETAILS"

echo

# Regenerate the local versions for the elements that get released
yarn workspaces foreach \
  --verbose --topological --no-private "${UPDATE_ARGUMENTS[@]}" \
  run update-local

# The v1 still uses the "berry.js" file path when using "policies set-version"
cp "$REPO_DIR"/packages/yarnpkg-cli/bin/yarn.js \
   "$REPO_DIR"/packages/berry-cli/bin/berry.js

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

# We need to revert the checked-in artifacts, since stable shouldn't move
# just yet, and some of our tools expect "latest" to always be up-to-date
if [[ $PRERELEASE -eq 1 ]]; then
  git checkout "$CURRENT_COMMIT" -- "$REPO_DIR"/../packages/*/bin
  git commit -m "Reset binaries to stable"
fi
