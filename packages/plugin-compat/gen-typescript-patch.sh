set -e

TSDIR="$1"
TMPDIR="$(mktemp -d)"

mkdir -p "$TMPDIR"/orig
mkdir -p "$TMPDIR"/patched

reset-git() {
    git checkout .
    git clean -df
}

(
    cd "$TSDIR"

    reset-git
    git checkout master

    yarn gulp local LKG
    cp -r lib "$TMPDIR"/orig/

    reset-git
    git checkout mael/pnp

    yarn gulp local LKG
    cp -r lib/ "$TMPDIR"/patched/
)

git diff --no-index "$TMPDIR"/orig "$TMPDIR"/patched \
    | perl -p -e"s#$TMPDIR/orig##" \
    | perl -p -e"s#$TMPDIR/patched##" \
    | perl -p -e"s#__spreadArrays#[].concat#" \
    > typescript.patch
