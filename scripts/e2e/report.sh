#!/usr/bin/env bash

set -e

NAME="$1"
shift

if "$@"; then
  printf '{"name": "%s", "failed": %d}\n' "${NAME}" 0 >> "${REPORT_PATH}"
else
  printf '{"name": "%s", "failed": %d}\n' "${NAME}" 1 >> "${REPORT_PATH}"
fi
