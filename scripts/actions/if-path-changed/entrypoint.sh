#!/usr/bin/env bash

set -e
echo

if [[ $GITHUB_EVENT_NAME != "push" ]]; then
  echo Expected a push event, got $GITHUB_EVENT_NAME instead
  exit 1
fi

if [[ ${1:-""} == "" ]]; then
  echo Expected a PERL pattern, got nothing instead
  exit 1
fi

PATTERN=${1}

echo === Pattern ===
echo "${PATTERN}"
echo

CHANGED="$(jq -r '.commits[] | (.added + .modified + .removed)[]' < "${GITHUB_EVENT_PATH}")"

echo === Changed ===
echo "${CHANGED}"
echo

MATCHES="$(echo "${CHANGED}" | grep -P "${PATTERN}" || true)"
COUNT="$(echo "${MATCHES}" | grep -v '^$' | wc -l)"

echo === Matches "(${COUNT})" ===
echo "${MATCHES}"
echo

if [[ ${COUNT} -gt 0 ]]; then
  exit 0
else
  exit 78
fi
