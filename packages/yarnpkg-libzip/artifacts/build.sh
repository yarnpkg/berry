#!/usr/bin/env bash

set -e

EMSDK_ENV=~/emsdk/emsdk_env.sh

THIS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$THIS_DIR"

ZLIB_VERSION=1.2.11
LIBZIP_VERSION=1.5.2

LIBZIP_REPO=arcanis/libzip

[[ -f ./zlib-"$ZLIB_VERSION"/libz.a ]] || (
  if ! [[ -e zlib-"$ZLIB_VERSION".tar.gz ]]; then
    wget -O ./zlib-"$ZLIB_VERSION".tar.gz "http://zlib.net/zlib-$ZLIB_VERSION.tar.gz"
  fi

  if ! [[ -e zlib-"$ZLIB_VERSION" ]]; then
    tar xvf ./zlib-"$ZLIB_VERSION".tar.gz
  fi

  cd "$THIS_DIR"/zlib-"$ZLIB_VERSION"

  source "$EMSDK_ENV"

  mkdir -p build
  cd build

  emcmake cmake -Wno-dev \
    ..

  emmake make zlibstatic

  mkdir -p local/lib local/include
  cp libz.a local/lib/
  cp zconf.h ../zlib.h local/include/

  echo Built zlib
)

[[ -f ./libzip-"$LIBZIP_VERSION"/build/lib/libzip.a ]] || (
  if [[ -n "$LIBZIP_REPO" ]]; then
    if ! [[ -e libzip-"$LIBZIP_VERSION" ]]; then
      git clone https://github.com/"$LIBZIP_REPO" libzip-"$LIBZIP_VERSION"
    fi
  else
    if ! [[ -e libzip-"$LIBZIP_VERSION".tar.gz ]]; then
      wget -O ./libzip-"$LIBZIP_VERSION".tar.gz "https://libzip.org/download/libzip-$LIBZIP_VERSION.tar.gz"
    fi

    if ! [[ -e libzip-"$LIBZIP_VERSION" ]]; then
      tar xvf ./libzip-"$LIBZIP_VERSION".tar.gz
    fi
  fi

  cd "$THIS_DIR"/libzip-"$LIBZIP_VERSION"

  source "$EMSDK_ENV"

  mkdir -p build
  cd build

  emcmake cmake -Wno-dev \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_LOCALTIME=OFF \
    -DENABLE_COMMONCRYPTO=OFF \
    -DENABLE_GNUTLS=OFF \
    -DENABLE_MBEDTLS=OFF \
    -DENABLE_OPENSSL=OFF \
    -DENABLE_WINDOWS_CRYPTO=OFF \
    -DZLIB_LIBRARY="$THIS_DIR"/zlib-"$ZLIB_VERSION"/build/local/lib/libz.a \
    -DZLIB_INCLUDE_DIR="$THIS_DIR"/zlib-"$ZLIB_VERSION"/build/local/include \
    ..

  emmake make zip

  mkdir -p local/lib local/include
  cp lib/libzip.a local/lib/
  cp zipconf.h ../lib/zip.h local/include/

  echo Built libzip
)

build() {
  local name=$1
  shift

  source "$EMSDK_ENV"

  emcc \
    -o ./build.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="$(cat ./exported.json)" \
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["cwrap", "getValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT=node \
    -s NODERAWFS=1 \
    -s SINGLE_FILE=1 \
    "$@" \
    -I./libzip-"$LIBZIP_VERSION"/build/local/include \
    -O3 \
    --llvm-lto 1 \
    ./zipstruct.c \
    ./libzip-"$LIBZIP_VERSION"/build/local/lib/libzip.a \
    ./zlib-"$ZLIB_VERSION"/build/local/lib/libz.a

  cat > ../sources/"$name".js \
    <(echo "var frozenFs = Object.assign({}, require('fs'));") \
    <(sed 's/require("fs")/frozenFs/g' ./build.js \
    | sed 's/process\["on"\]/(function(){})/g' \
    | sed 's/process\["binding"\]("constants")/({"fs":fs.constants})/g')

  yarn prettier --write ../sources/"$name".js

  echo "Built wasm ($name)"
}

build libzipSync -s BINARYEN_ASYNC_COMPILATION=0
build libzipAsync -s BINARYEN_ASYNC_COMPILATION=1
