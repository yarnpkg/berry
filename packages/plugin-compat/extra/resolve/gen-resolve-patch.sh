set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="$(mktemp -d)"

mkdir -p "$TEMP_DIR"/orig
mkdir -p "$TEMP_DIR"/patched

cd "$TEMP_DIR"/orig
wget -q https://registry.yarnpkg.com/resolve/-/resolve-1.14.1.tgz
tar xvfz resolve-1.14.1.tgz 2> /dev/null

cd "$TEMP_DIR"/patched
cp "$TEMP_DIR"/orig/resolve-1.14.1.tgz .
tar xvfz resolve-1.14.1.tgz 2> /dev/null

cp "$THIS_DIR"/normalize-options.js "$TEMP_DIR"/patched/package/lib/normalize-options.js

git diff --no-index "$TEMP_DIR"/orig/package "$TEMP_DIR"/patched/package \
  | perl -p -e"s#^--- #semver exclusivity >=1.9\n--- #" \
  | perl -p -e"s#$TEMP_DIR/orig/package##" \
  | perl -p -e"s#$TEMP_DIR/patched/package##" \
  > "$TEMP_DIR"/patch.tmp

node "$THIS_DIR/../createPatch.js" "$TEMP_DIR"/patch.tmp "$THIS_DIR"/../../sources/patches/resolve.patch.ts
