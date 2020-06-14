set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="/tmp/ts-repo"

PATCHFILE="$TEMP_DIR"/patch.tmp
JSPATCH="$THIS_DIR"/../../sources/patches/typescript.patch.ts

FIRST_PR_COMMIT="5d50de3"

HASHES=(
  # Patch   # Base    # Ranges
  "426f5a7" "e39bdc3" ">=3.0 <3.5"
  "426f5a7" "cf7b2d4" ">=3.5 <3.6"
  "2f85932" "e39bdc3" ">=3.6 <3.9"
  "3af06df" "551f0dd" ">=3.9"
)

mkdir -p "$TEMP_DIR"
if ! [[ -d "$TEMP_DIR"/clone ]]; then (
    git clone https://github.com/arcanis/typescript "$TEMP_DIR"/clone
    cd "$TEMP_DIR"/clone
    git remote add upstream https://github.com/microsoft/typescript
); fi

rm -rf "$TEMP_DIR"/builds
cd "$TEMP_DIR"/clone

git cherry-pick --abort || true

git config user.email "you@example.com"
git config user.name "Your Name"

git fetch origin
git fetch upstream

reset-git() {
  git reset --hard "$1"
  git clean -df

  npm install --before "$(git show -s --format=%ci)"
}

build-dir-for() {
  local HASH="$1"
  local CHERRY_PICK="$2"

  local BUILD_DIR="$TEMP_DIR"/builds/"$HASH"

  if [[ ! -z "$CHERRY_PICK" ]]; then
    BUILD_DIR="$BUILD_DIR-$CHERRY_PICK"
  fi

  echo "$BUILD_DIR"
}

make-build-for() {
  local HASH="$1"
  local CHERRY_PICK="$2"

  local BUILD_DIR="$(build-dir-for "$HASH" "$CHERRY_PICK")"

  if [[ ! -e "$BUILD_DIR" ]]; then
    mkdir -p "$BUILD_DIR"
    reset-git "$HASH"

    if [[ ! -z "$CHERRY_PICK" ]]; then
      if git merge-base --is-ancestor "$HASH" "$CHERRY_PICK"; then
        git merge --no-edit "$CHERRY_PICK"
      else
        git cherry-pick "$FIRST_PR_COMMIT"^.."$CHERRY_PICK"
      fi
    fi

    yarn gulp local LKG
    cp -r lib/ "$BUILD_DIR"/
  fi

  echo "$BUILD_DIR"
}

rm -f "$PATCHFILE" && touch "$PATCHFILE"
rm -f "$JSPATCH" && touch "$JSPATCH"

while [[ ${#HASHES[@]} -gt 0 ]]; do
  HASH="${HASHES[0]}"
  BASE="${HASHES[1]}"
  RANGE="${HASHES[2]}"
  HASHES=("${HASHES[@]:3}")

  make-build-for "$BASE"
  ORIG_DIR=$(build-dir-for "$BASE")

  make-build-for "$BASE" "$HASH"
  PATCHED_DIR=$(build-dir-for "$BASE" "$HASH")

  DIFF="$THIS_DIR"/patch."${HASH}"-on-"${BASE}".diff

  git diff --no-index "$ORIG_DIR" "$PATCHED_DIR" \
    | perl -p -e"s#^--- #semver exclusivity $RANGE\n--- #" \
    | perl -p -e"s#$ORIG_DIR/#/#" \
    | perl -p -e"s#$PATCHED_DIR/#/#" \
    | perl -p -e"s#__spreadArrays#[].concat#" \
    > "$DIFF"

  cat "$DIFF" \
    >> "$PATCHFILE"
done

node "$THIS_DIR/../createPatch.js" "$PATCHFILE" "$JSPATCH"
