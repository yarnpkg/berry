set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="$(mktemp -d)"

cat "$THIS_DIR"/1.2.11.patch \
    "$THIS_DIR"/2.1.2.patch \
    "$THIS_DIR"/common.patch \
  > "$TEMP_DIR"/patch.tmp

node "$THIS_DIR/../createPatch.js" "$TEMP_DIR"/patch.tmp "$THIS_DIR"/../../sources/patches/fsevents.patch.ts
