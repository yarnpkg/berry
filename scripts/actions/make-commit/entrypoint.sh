#!/usr/bin/env bash

set -e
echo

if [[ ${YARNBOT_TOKEN:-""} == "" ]]; then
  echo Expected a valid Github token in YARNBOT_TOKEN, got nothing instead
  exit 1
fi

git config --global user.email "nison.mael+yarnbot@gmail.com"
git config --global user.name "Friendly Yarn Bot"

git remote add yarnbot https://yarnbot:"${YARNBOT_TOKEN}"@github.com/"${GITHUB_REPOSITORY}".git
git add .
git commit -m "${*}"
git push yarnbot "${GITHUB_REF}"
