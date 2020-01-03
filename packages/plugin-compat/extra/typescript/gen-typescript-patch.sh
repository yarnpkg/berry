set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="$(mktemp -d)"

git clone git@github.com:arcanis/typescript "$TEMP_DIR"/clone

mkdir -p "$TEMP_DIR"/orig
mkdir -p "$TEMP_DIR"/patched

reset-git() {
  git checkout .
  git clean -df
}

cd "$TEMP_DIR"/clone

yarn

reset-git
git checkout master

yarn gulp local LKG
cp -r lib "$TEMP_DIR"/orig/

reset-git
git checkout mael/pnp

yarn gulp local LKG
cp -r lib/ "$TEMP_DIR"/patched/

PATCHFILE="$THIS_DIR"/../../sources/patches/typescript.patch.ts
rm -f "$PATCHFILE" && touch "$PATCHFILE"

echo 'export const patch =' \
  >> "$PATCHFILE"
git diff --no-index "$TEMP_DIR"/orig "$TEMP_DIR"/patched \
  | perl -p -e"s#$TEMP_DIR/orig##" \
  | perl -p -e"s#$TEMP_DIR/patched##" \
  | perl -p -e"s#__spreadArrays#[].concat#" \
  > "$TEMP_DIR"/patch.tmp || true
node "$THIS_DIR"/../jsonEscape.js < "$TEMP_DIR"/patch.tmp \
  >> "$PATCHFILE"
echo ';' \
  >> "$PATCHFILE"
