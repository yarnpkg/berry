WORKSPACE_DIR="$(dirname "$PWD")"

# TODO: Pass "--weak-refs" once https://github.com/rustwasm/wasm-pack/pull/937 is merged.
# TODO: Enable simd after dropping support for Node 14.
# TODO: Enable support for WASM reference types after it stabilizes.
yarn wasm-pack build \
  --release \
  --target nodejs \
  --out-dir ./pkg \
  --out-name build \
  . \
  -- \
  -Z build-std=std,panic_abort \
  -Z build-std-features=panic_immediate_abort

WASM_CONTENT="$(node -p "fs.readFileSync('./pkg/build_bg.wasm', 'base64')")"
JS_CONTENT="$(cat ./pkg/build.js)"

NEWLINE=$'\n'

SEARCH_VALUE="const path = require('path').join(__dirname, 'build_bg.wasm');${NEWLINE}const bytes = require('fs').readFileSync(path);"
REPLACE_VALUE="const bytes = Buffer.from('$WASM_CONTENT', 'base64');"

echo "${JS_CONTENT//"$SEARCH_VALUE"/"$REPLACE_VALUE"}" \
  > ../sources/grammars/syml.js

cp ./pkg/build.d.ts ../sources/grammars/syml.d.ts

echo "Built parser at $WORKSPACE_DIR/sources/grammars/syml.js"

echo "Bundled WASM file size: ${#WASM_CONTENT} bytes"
