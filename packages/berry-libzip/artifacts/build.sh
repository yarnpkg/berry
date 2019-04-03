#!/usr/bin/env bash

set -e

THIS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

ZLIB_VERSION=1.2.11
LIBZIP_VERSION=1.5.1

[[ -f ./zlib-"$ZLIB_VERSION"/libz.a ]] || (
    cd "$THIS_DIR"

    if ! [[ -e zlib-"$ZLIB_VERSION".tar.gz ]]; then
        wget -O ./zlib-"$ZLIB_VERSION".tar.gz "http://zlib.net/zlib-$ZLIB_VERSION.tar.gz"
    fi

    if ! [[ -e zlib-"$ZLIB_VERSION" ]]; then
        tar xvf ./zlib-"$ZLIB_VERSION".tar.gz
    fi

    cd "$THIS_DIR"/zlib-"$ZLIB_VERSION"

    source ~/emsdk-portable/emsdk_env.sh

    emcmake cmake -Wno-dev .
    emmake make zlibstatic
)

(
    cd "$THIS_DIR"

    if ! [[ -e libzip-"$LIBZIP_VERSION".tar.gz ]]; then
        wget -O ./libzip-"$LIBZIP_VERSION".tar.gz "https://libzip.org/download/libzip-$LIBZIP_VERSION.tar.gz"
    fi

    if ! [[ -e libzip-"$LIBZIP_VERSION" ]]; then
        tar xvf ./libzip-"$LIBZIP_VERSION".tar.gz
        sed s/localtime/gmtime/g \
            <<< "$(cat ./libzip-"$LIBZIP_VERSION"/lib/zip_dirent.c)" \
            > ./libzip-"$LIBZIP_VERSION"/lib/zip_dirent.c
    fi

    cd "$THIS_DIR"/libzip-"$LIBZIP_VERSION"

    source ~/emsdk-portable/emsdk_env.sh

    emcmake cmake -Wno-dev -DBUILD_SHARED_LIBS=OFF -DENABLE_GNUTLS=OFF -DENABLE_OPENSSL=OFF -DENABLE_COMMONCRYPTO=OFF -DZLIB_LIBRARY="$THIS_DIR"/zlib-"$ZLIB_VERSION"/libz.a -DZLIB_INCLUDE_DIR="$THIS_DIR"/zlib-"$ZLIB_VERSION" .
    emmake make zip

    echo Built zip
)

(
    cd "$THIS_DIR"

    source ~/emsdk-portable/emsdk_env.sh

    emcc \
        -o ./build.js \
        -s WASM=1 \
        -s EXPORTED_FUNCTIONS="$(cat ./exported.json)" \
        -s EXTRA_EXPORTED_RUNTIME_METHODS='["cwrap", "getValue"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s BINARYEN_ASYNC_COMPILATION=0 \
        -s ENVIRONMENT=node \
        -s NODERAWFS=1 \
        -s SINGLE_FILE=1 \
        -s ASSERTIONS=1 -s SAFE_HEAP=1 \
        -I./libzip-"$LIBZIP_VERSION"/lib \
        -I./libzip-"$LIBZIP_VERSION" \
        -O3 \
        --llvm-lto 1 \
        ./zipstruct.c \
        ./libzip-"$LIBZIP_VERSION"/lib/libzip.a \
        ./zlib-"$ZLIB_VERSION"/libz.a

    cat > ../sources/libzip.js \
        "../sources/shell.pre.js" \
        <(sed 's/require("fs")/frozenFs/g' ./build.js | sed 's/process\["on"\]/(function(){})/g') \
        "../sources/shell.post.js"

)
