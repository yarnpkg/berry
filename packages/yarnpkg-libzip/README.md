# `@yarnpkg/libzip`

This package contains a wasm-compiled version of the libzip.

## Upgrade the libzip build

- Bump the version numbers in `artifacts/build.sh`
- Run the `artifacts/build.sh` script

## Expose new functions

- Add the new functions to `artifacts/exported.json`
- List them in `sources/index.ts`
- Run the `artifacts/build.sh` script
