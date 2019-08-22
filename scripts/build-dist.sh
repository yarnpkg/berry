#!/bin/bash
set -Exu
set -o pipefail
# Builds the release tarball for Yarn.

umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)

version=$(yarn --version)

mkdir -p artifacts
mkdir -p dist

cp README.md dist/
cp LICENSE.md dist/
cp packages/berry-cli/bundles/berry.js dist/berry.js
# TODO: Create .cmd wrapper for Windows
chmod +x dist/berry.js

case "$(tar --version)" in
  *GNU*)
    tar -cvzf artifacts/yarn-next-v$version.tar.gz --transform="s/^dist/yarn-next-v$version/" dist/*
    ;;
  bsdtar*)
    tar -cvzf artifacts/yarn-next-v$version.tar.gz -s "/^dist/yarn-next-v$version/" dist/*
    ;;
  *)
    echo "Can't determine tar type (BSD/GNU)!"
    exit 1
    ;;
esac
