#!/usr/bin/env bash

set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR="$THIS_DIR/../.."

if ! [[ -z $(git status --porcelain) ]]; then
  echo 'This command must be executed on a clean repository'
  exit 1
fi

RELEASE_ARGUMENTS=()

CLOSEST_TAG=$(git describe --tags --abbrev=0)
RELEASE_COMMIT=$(git rev-list -n 1 "$CLOSEST_TAG")

maybe_release_package() {
  if git describe --match "$1/*" $RELEASE_COMMIT >&/dev/null; then
    RELEASE_ARGUMENTS+=(--include "$1")
  fi
}

while read ident; do
  maybe_release_package "$ident"
done < <(yarn constraints query --json "workspace_ident(Cwd, Ident), \+ workspace_field(Cwd, 'private', 'true')" | jq -r .Ident)

if [[ ${#RELEASE_ARGUMENTS[@]} -eq 0 ]]; then
  exit 0
fi

YARN_NPM_PUBLISH_REGISTRY=https://npm.pkg.github.com yarn workspaces foreach \
  --verbose --topological --no-private "${RELEASE_ARGUMENTS[@]}" \
  npm publish --tolerate-republish

yarn workspaces foreach \
  --verbose --topological --no-private "${RELEASE_ARGUMENTS[@]}" \
  npm publish --tolerate-republish
