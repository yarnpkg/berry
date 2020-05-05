set -ex

THIS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMP_DIR="$(mktemp -d)"

echo $TEMP_DIR

PATCHFILE="$THIS_DIR"/../../sources/patches/fsevents.patch.ts
rm -f "$PATCHFILE" && touch "$PATCHFILE"

echo '/* eslint-disable */' \
  >> "$JSPATCH"
echo 'export const patch =' \
  >> "$PATCHFILE"
(cat "$THIS_DIR"/1.2.11.patch \
     "$THIS_DIR"/2.1.2.patch \
     "$THIS_DIR"/common.patch) \
  > "$TEMP_DIR"/patch.tmp || true
node "$THIS_DIR"/../jsonEscape.js < "$TEMP_DIR"/patch.tmp \
  >> "$PATCHFILE"
echo ';' \
  >> "$PATCHFILE"
