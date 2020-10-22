set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="/tmp/ts-repo"

PATCHFILE="$TEMP_DIR"/patch.tmp
JSPATCH="$THIS_DIR"/../../sources/patches/typescript.patch.ts

FIRST_PR_COMMIT="5d50de3"

# Defines which commits need to be cherry-picked onto which other commit to
# generate a patch suitable for the specified range.
HASHES=(
  # From    # To      # Onto    # Ranges
  "5d50de3" "426f5a7" "e39bdc3" ">=3.2 <3.5"
  "5d50de3" "426f5a7" "cf7b2d4" ">=3.5 <=3.6"
  "5d50de3" "426f5a7" "cda54b8" ">3.6 <3.7"
  "5d50de3" "2f85932" "e39bdc3" ">=3.7 <3.9"
  "5d50de3" "3af06df" "551f0dd" ">=3.9 <4.0"
  "6dbdd2f" "6dbdd2f" "56865f7" ">=4.0 <4.1"
  "746d79b" "746d79b" "69972a3" ">=4.1"
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
  local CHERRYPICK_ONTO="$1"
  local CHERRYPICK_TO="$2"

  local BUILD_DIR="$TEMP_DIR"/builds/"$CHERRYPICK_ONTO"

  if [[ ! -z "$CHERRYPICK_TO" ]]; then
    BUILD_DIR="$BUILD_DIR-$CHERRYPICK_TO"
  fi

  echo "$BUILD_DIR"
}

make-build-for() {
  local CHERRYPICK_ONTO="$1"
  local CHERRYPICK_FROM="$2"
  local CHERRYPICK_TO="$3"

  local BUILD_DIR="$(build-dir-for "$CHERRYPICK_ONTO" "$CHERRYPICK_TO")"

  if [[ ! -e "$BUILD_DIR" ]]; then
    mkdir -p "$BUILD_DIR"
    reset-git "$CHERRYPICK_ONTO"

    if [[ ! -z "$CHERRYPICK_TO" ]]; then
      if git merge-base --is-ancestor "$CHERRYPICK_ONTO" "$CHERRYPICK_TO"; then
        git merge --no-edit "$CHERRYPICK_TO"
      else
        git cherry-pick "$CHERRYPICK_FROM"^.."$CHERRYPICK_TO"
      fi
    fi

    for n in {5..1}; do
      yarn gulp local LKG

      if [[ $(stat -c%s lib/typescript.js) -gt 100000 ]]; then
        break
      else
        echo "Something is wrong; typescript.js got generated with a stupid size" >& /dev/stderr
        cat -e lib/typescript.js

        if [[ $n -eq 1 ]]; then
          exit 1
        fi

        rm -rf lib
        git reset --hard lib
      fi
    done

    cp -r lib/ "$BUILD_DIR"/
  fi

  echo "$BUILD_DIR"
}

rm -f "$PATCHFILE" && touch "$PATCHFILE"
rm -f "$JSPATCH" && touch "$JSPATCH"

while [[ ${#HASHES[@]} -gt 0 ]]; do
  CHERRYPICK_FROM="${HASHES[0]}"
  CHERRYPICK_TO="${HASHES[1]}"
  CHERRYPICK_ONTO="${HASHES[2]}"
  RANGE="${HASHES[3]}"
  HASHES=("${HASHES[@]:4}")

  make-build-for "$CHERRYPICK_ONTO"
  ORIG_DIR=$(build-dir-for "$CHERRYPICK_ONTO")

  make-build-for "$CHERRYPICK_ONTO" "$CHERRYPICK_FROM" "$CHERRYPICK_TO"
  PATCHED_DIR=$(build-dir-for "$CHERRYPICK_ONTO" "$CHERRYPICK_FROM")

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
