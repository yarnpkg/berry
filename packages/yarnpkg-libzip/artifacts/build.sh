#!/usr/bin/env bash

set -e

EMSDK_ENV=~/emsdk/emsdk_env.sh
EMSDK_VERSION=2.0.22

~/emsdk/emsdk install $EMSDK_VERSION
~/emsdk/emsdk activate $EMSDK_VERSION

THIS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$THIS_DIR"

ZLIB_VERSION=1.2.11
LIBZIP_VERSION=1.5.2 # Ignored at the moment; we use a fork, cf next params

LIBZIP_REPO=arcanis/libzip
LIBZIP_COMMIT=664462465d2730d51f04437c90ed7ebcbe19a36f

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

      cd libzip-"$LIBZIP_VERSION"
      git checkout "$LIBZIP_COMMIT"
      cd ..
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
  cp config.h zipconf.h ../lib/zip.h ../lib/compat.h ../lib/zipint.h local/include/

  echo Built libzip
)

build() {
  local name=$1
  shift

  source "$EMSDK_ENV"

  # Options are documented at https://github.com/emscripten-core/emscripten/blob/86131037aa4f1c7bf6021081dd28fae12bdedba1/src/settings.js
  emcc \
    -o ./build.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="$(cat ./exported.json)" \
    -s EXPORTED_RUNTIME_METHODS='["cwrap", "getValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT=node \
    -s NODERAWFS=1 \
    -s SINGLE_FILE=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createModule" \
    -s NODEJS_CATCH_EXIT=0 \
    -s NODEJS_CATCH_REJECTION=0 \
    "$@" \
    -I./libzip-"$LIBZIP_VERSION"/build/local/include \
    -I./zlib-"$ZLIB_VERSION"/build/local/include \
    -O3 \
    ./lib/*.c \
    ./libzip-"$LIBZIP_VERSION"/build/local/lib/libzip.a \
    ./zlib-"$ZLIB_VERSION"/build/local/lib/libz.a

  cat > ../sources/"$name".js \
    <(echo "var frozenFs = Object.assign({}, require('fs'));") \
    <(sed 's/require("fs")/frozenFs/g' ./build.js \
    | sed 's/process\["binding"\]("constants")/({"fs":fs.constants})/g')

  yarn prettier --write ../sources/"$name".js

  echo "Built wasm ($name)"
}

build libzipSync -s BINARYEN_ASYNC_COMPILATION=0
build libzipAsync -s BINARYEN_ASYNC_COMPILATION=1
