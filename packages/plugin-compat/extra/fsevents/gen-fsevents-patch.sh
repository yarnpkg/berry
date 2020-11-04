set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="$(mktemp -d)"

cd "$TEMP_DIR"

wget https://registry.yarnpkg.com/fsevents/-/fsevents-1.2.11.tgz
wget https://registry.yarnpkg.com/fsevents/-/fsevents-2.1.2.tgz
wget https://registry.yarnpkg.com/fsevents/-/fsevents-2.2.0.tgz

tar xvf fsevents-1.2.11.tgz
cp -rf package copy

cp "$THIS_DIR"/fsevents-1.2.11.js copy/fsevents.js
cp "$THIS_DIR"/vfs.js copy/vfs.js
git diff -U2 --src-prefix=a/ --dst-prefix=b/ --ignore-cr-at-eol --ignore-space-change --full-index --no-index package copy > "$THIS_DIR"/fsevents-1.2.11.patch || true

rm -rf package copy

tar xvf fsevents-2.1.2.tgz
cp -rf package copy

cp "$THIS_DIR"/fsevents-2.1.2.js copy/fsevents.js
cp "$THIS_DIR"/vfs.js copy/vfs.js
git diff -U2 --src-prefix=a/ --dst-prefix=b/ --ignore-cr-at-eol --ignore-space-change --full-index --no-index package copy > "$THIS_DIR"/fsevents-2.1.2.patch || true

rm -rf package copy

tar xvf fsevents-2.2.0.tgz
cp -rf package copy

cp "$THIS_DIR"/fsevents-2.2.0.js copy/fsevents.js
cp "$THIS_DIR"/vfs.js copy/vfs.js
git diff -U2 --src-prefix=a/ --dst-prefix=b/ --ignore-cr-at-eol --ignore-space-change --full-index --no-index package copy > "$THIS_DIR"/fsevents-2.2.0.patch || true

perl -p -i -e 's#a/package/#a/#' "$THIS_DIR"/fsevents-1.2.11.patch
perl -p -i -e 's#b/copy/#b/#' "$THIS_DIR"/fsevents-1.2.11.patch
perl -p -i -e 's#^--- #semver exclusivity ^1\'$'\n''--- #' "$THIS_DIR"/fsevents-1.2.11.patch

perl -p -i -e 's#a/package/#a/#' "$THIS_DIR"/fsevents-2.1.2.patch
perl -p -i -e 's#b/copy/#b/#' "$THIS_DIR"/fsevents-2.1.2.patch
perl -p -i -e 's#^--- #semver exclusivity >=2.1 <2.2\'$'\n''--- #' "$THIS_DIR"/fsevents-2.1.2.patch

perl -p -i -e 's#a/package/#a/#' "$THIS_DIR"/fsevents-2.2.0.patch
perl -p -i -e 's#b/copy/#b/#' "$THIS_DIR"/fsevents-2.2.0.patch
perl -p -i -e 's#^--- #semver exclusivity ^2.2\'$'\n''--- #' "$THIS_DIR"/fsevents-2.2.0.patch

cat "$THIS_DIR"/fsevents-1.2.11.patch \
    "$THIS_DIR"/fsevents-2.1.2.patch \
    "$THIS_DIR"/fsevents-2.2.0.patch \
  > "$TEMP_DIR"/fsevents.patch

node "$THIS_DIR/../createPatch.js" "$TEMP_DIR"/fsevents.patch "$THIS_DIR"/../../sources/patches/fsevents.patch.ts
