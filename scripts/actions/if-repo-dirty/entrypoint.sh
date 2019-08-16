#!/usr/bin/env bash

set -e
echo

STATUS=$(git status --short)

echo === Changed ===
echo "${STATUS}"
echo

if [[ -n ${STATUS} ]]; then
  exit 0
else
  exit 78
fi
