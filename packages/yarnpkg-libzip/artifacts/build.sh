#!/usr/bin/env bash

set -e

EMSDK_VERSION=2.0.22

THIS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$THIS_DIR"

ZLIB_VERSION=2.0.6
LIBZIP_VERSION=1.5.2 # Ignored at the moment; we use a fork, cf next params

LIBZIP_REPO=arcanis/libzip
LIBZIP_COMMIT=664462465d2730d51f04437c90ed7ebcbe19a36f

ZLIB_ROOT="$THIS_DIR/zlib-ng-$ZLIB_VERSION"
LIBZIP_ROOT="$THIS_DIR/libzip-$LIBZIP_VERSION"

[[ -f "$ZLIB_ROOT/build/libz.a" ]] || (
  if ! [[ -e zlib-"$ZLIB_VERSION".zip ]]; then
    wget -O ./zlib-"$ZLIB_VERSION".zip "https://github.com/zlib-ng/zlib-ng/archive/refs/tags/$ZLIB_VERSION.zip"
  fi

  if ! [[ -e "$ZLIB_ROOT" ]]; then
    unzip ./zlib-"$ZLIB_VERSION".zip
  fi

  mkdir -p "$ZLIB_ROOT/build"

  docker run --rm \
    -v "$ZLIB_ROOT:/zlib" \
    -u $(id -u):$(id -g) \
    --env CHOST="wasm32" \
    --env CFLAGS="-O3" \
    -w "/zlib/build" \
    emscripten/emsdk:$EMSDK_VERSION \
    emconfigure ../configure --warn --zlib-compat --static

  docker run --rm \
    -v "$ZLIB_ROOT:/zlib" \
    -u $(id -u):$(id -g) \
    -w "/zlib/build" \
    emscripten/emsdk:$EMSDK_VERSION \
    emmake make -j2

  cd "$ZLIB_ROOT/build"
  mkdir -p local/lib local/include
  cp libz.a local/lib/
  cp zconf.h ../zlib.h local/include/

  echo Built zlib
)

[[ -f "$LIBZIP_ROOT/build/lib/libzip.a" ]] || (
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

  mkdir -p "$LIBZIP_ROOT/build"

  docker run --rm \
    -v "$LIBZIP_ROOT:/libzip" \
    -v "$ZLIB_ROOT:/zlib" \
    -u $(id -u):$(id -g) \
    -w "/libzip/build" \
    --env CFLAGS="-O3" \
    emscripten/emsdk:$EMSDK_VERSION \
    emcmake cmake -Wno-dev \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_LOCALTIME=OFF \
    -DENABLE_COMMONCRYPTO=OFF \
    -DENABLE_GNUTLS=OFF \
    -DENABLE_MBEDTLS=OFF \
    -DENABLE_OPENSSL=OFF \
    -DENABLE_WINDOWS_CRYPTO=OFF \
    -DZLIB_LIBRARY=/zlib/build/local/lib/libz.a \
    -DZLIB_INCLUDE_DIR=/zlib/build/local/include \
    ..

  docker run --rm \
    -v "$LIBZIP_ROOT:/libzip" \
    -v "$ZLIB_ROOT:/zlib" \
    -u $(id -u):$(id -g) \
    -w "/libzip/build" \
    emscripten/emsdk:$EMSDK_VERSION \
    emmake make zip

  cd "$LIBZIP_ROOT/build"
  mkdir -p local/lib local/include
  cp lib/libzip.a local/lib/
  cp config.h zipconf.h ../lib/zip.h ../lib/compat.h ../lib/zipint.h local/include/

  echo Built libzip
)

build() {
  local name=$1
  shift

  # Options are documented at https://github.com/emscripten-core/emscripten/blob/86131037aa4f1c7bf6021081dd28fae12bdedba1/src/settings.js
  docker run --rm \
    -v "$THIS_DIR:/src" \
    -v "$LIBZIP_ROOT:/libzip" \
    -v "$ZLIB_ROOT:/zlib" \
    -u $(id -u):$(id -g) \
    -w "/src" \
    emscripten/emsdk:$EMSDK_VERSION \
    emcc \
    -o ./$name.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="$(cat ./exported.json)" \
    -s EXPORTED_RUNTIME_METHODS='["cwrap", "getValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s SUPPORT_BIG_ENDIAN=1 \
    -s TEXTDECODER=2 \
    -s ENVIRONMENT=node \
    -s NODERAWFS=1 \
    -s SINGLE_FILE=1 \
    -s MODULARIZE=1 \
    -s STRICT=1 \
    -s EXPORT_NAME="createModule" \
    -s NODEJS_CATCH_EXIT=0 \
    -s NODEJS_CATCH_REJECTION=0 \
    "$@" \
    -I/libzip/build/local/include \
    -I/zlib/build/local/include \
    -O3 \
    ./lib/*.c \
    /libzip/build/local/lib/libzip.a \
    /zlib/build/local/lib/libz.a

  cat >../sources/"$name".js \
    <(echo "var frozenFs = Object.assign({}, require('fs'));") \
    <(sed 's/require("fs")/frozenFs/g' ./$name.js |
      sed 's/process\["binding"\]("constants")/({"fs":fs.constants})/g')

  echo "Built wasm ($name)"
}

build libzipSync -s WASM_ASYNC_COMPILATION=0 &
build libzipAsync -s WASM_ASYNC_COMPILATION=1 &
wait

yarn prettier --write ../sources/*.js
