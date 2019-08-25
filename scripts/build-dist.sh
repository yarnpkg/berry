#!/bin/bash
set -Exu
set -o pipefail
# Builds the release tarball for Yarn.

umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)

version=$(node packages/berry-cli/bundles/berry.js --version)

rm -rf dist
mkdir -p artifacts
mkdir -p dist/bin

cp README.md dist/
cp LICENSE.md dist/
cp packages/berry-cli/bundles/berry.js dist/bin/yarn.js
cp scripts/dist-scripts/yarn dist/bin/yarn
cp scripts/dist-scripts/yarn.cmd dist/bin/yarn.cmd
cp scripts/dist-scripts/yarn.ps1 dist/bin/yarn.ps1
# Create yarnpkg as symlink to yarn
ln -s yarn dist/bin/yarnpkg
# Ensure all scripts are executable
chmod +x dist/bin/*

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
