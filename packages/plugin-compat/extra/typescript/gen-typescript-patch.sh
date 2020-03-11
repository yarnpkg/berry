set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="$(mktemp -d)"

HASHES=(
  "426f5a7" ">=3 <3.6"
  "bcb6dbf" ">3.6"
)

git clone git@github.com:arcanis/typescript "$TEMP_DIR"/clone

mkdir -p "$TEMP_DIR"/orig
mkdir -p "$TEMP_DIR"/patched

reset-git() {
  git checkout .
  git clean -df

  yarn
}

cd "$TEMP_DIR"/clone

reset-git
git checkout master

yarn gulp local LKG
cp -r lib "$TEMP_DIR"/orig/

while [[ ${#HASHES[@]} -gt 0 ]]; do
  HASH="${HASHES[0]}"
  RANGE="${HASHES[1]}"
  HASHES=("${HASHES[@]:2}")

  reset-git
  git checkout "$HASH"

  yarn gulp local LKG
  cp -r lib/ "$TEMP_DIR"/patched/

  PATCHFILE="$THIS_DIR"/../../sources/patches/typescript.patch.ts
  rm -f "$PATCHFILE" && touch "$PATCHFILE"

  git diff --no-index "$TEMP_DIR"/orig "$TEMP_DIR"/patched \
    | perl -p -e"s#^--- #semver exclusivity $RANGE\n--- #" \
    | perl -p -e"s#$TEMP_DIR/orig##" \
    | perl -p -e"s#$TEMP_DIR/patched##" \
    | perl -p -e"s#__spreadArrays#[].concat#" \
    >> "$TEMP_DIR"/patch.tmp || true
done

echo 'export const patch =' \
  >> "$PATCHFILE"
node "$THIS_DIR"/../jsonEscape.js < "$TEMP_DIR"/patch.tmp \
  >> "$PATCHFILE"
echo ';' \
  >> "$PATCHFILE"

