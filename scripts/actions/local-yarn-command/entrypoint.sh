#!/usr/bin/env bash

set -e
echo

# The version of libvips available on alpine doesn't support svg
export SHARP_IGNORE_GLOBAL_LIBVIPS=1

NONCE="$(cat /proc/sys/kernel/random/uuid | sha256sum | head -c 64)"

echo "::stop-commands::$HASH"
exec node ./scripts/run-yarn.js "$@"
echo "::$HASH::"
