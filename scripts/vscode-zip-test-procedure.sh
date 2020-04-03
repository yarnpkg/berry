STEP_ID=0
step() {
  STEP_ID=$(($STEP_ID + 1))
  printf '%d. %s' "$STEP_ID" "$1"
  read
}

VSCODE_PID=
open_vscode() {
  if [[ "$VSCODE_PID" != "" ]]; then
    kill -9 "$VSCODE_PID" >& /dev/null || true
    wait "$VSCODE_PID" >& /dev/null || true
  fi
  step "VSCode will open when you press enter"
  "$VSCODE_DIR"/scripts/code.sh "$1" >& /dev/null &
  VSCODE_PID=$!
}

setup() {
  PM="$1"
  shift

  echo
  echo 'Preparing a temporary folder...'

  cd "$(realpath "$(mktemp -d)")"
  "$PM" "$@" >& /dev/null
  "$PM" add @sindresorhus/slugify >& /dev/null

  cat > tsconfig.json <<EOF
{
  "compilerOptions": {
    "esModuleInterop": true,
    "moduleResolution": "node"
  }
}
EOF

  cat > index.ts <<EOF
import slugify from "@sindresorhus/slugify";
const x: number = slugify("foobar");
EOF
}

echo "This script will execute everything automatically; just follow the step"
echo "and press enter once you have checked the step works. If you wish to abort,"
echo "just press ctrl-c in this terminal."

## Tests regarding the feature itself

setup npm init -y
open_vscode "$(pwd)"

step "Open index.ts, check that 'x' has an error"
step "Remove the ': number', the error should disappear"
step "Command-click on '@sindresorhus/slugify' from 'import slugify', you should see a file open"

setup npm init -y
npm install typescript@2.9 >& /dev/null
open_vscode "$(pwd)"

step "Press Command+Shift+P, 'Select TypeScript version', 'Use workspace version'"
step "Check that 'Typescript 2.9' appears in the bottom-right of the window"
step "Check that 'x' has an error"
step "Remove the ': number', the error should disappear"
step "Command-click on '@sindresorhus/slugify', a tab should open on '.../slugify/index.d.ts'"
step "Going back to the previous file, command-click on 'slugify' from 'import slugify', you should see a bubble open"
step "Check that clicking on both 'namespace slugify {' and 'function slugify {' print more details in the bubble"
step "Check that double-clicking on both 'namespace slugify {' and 'function slugify {' leads you to the right symbols"

setup yarn init -2y
open_vscode "$(pwd)"

step "Open index.ts, check that '@sindresorhus/slugify' has an error (cannot find module)"

setup yarn init -2y
yarn add typescript@3.8 >& /dev/null
yarn dlx @yarnpkg/pnpify --sdk >& /dev/null
open_vscode "$(pwd)"

step "Open index.ts"
step "Press Command+Shift+P, 'Select TypeScript version', 'Use workspace version'"
step "Check that 'Typescript 3.8-pnpify' appears in the bottom-right of the window"
step "Check that 'x' has an error"
step "Remove the ': number', the error should disappear"
step "Command-click on '@sindresorhus/slugify', a tab should open on '.../slugify/index.d.ts' (you shouldn't see any error in the lower corner!)"
step "Going back to the previous file, command-click on 'slugify' from 'import slugify', you should see a bubble open"
step "Check that clicking on both 'namespace slugify {' and 'function slugify {' print more details in the bubble"
step "Check that double-clicking on both 'namespace slugify {' and 'function slugify {' leads you to the right symbols"
