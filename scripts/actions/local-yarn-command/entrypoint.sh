#!/usr/bin/env bash

set -e
echo

# The version of libvips available on alpine doesn't support svg
export SHARP_IGNORE_GLOBAL_LIBVIPS=1

exec node ./scripts/run-yarn.js "$@"
