#!/usr/bin/env bash

set -e
echo

if [[ ${GITHUB_TOKEN:-""} == "" ]]; then
  echo Expected a valid Github token in GITHUB_TOKEN, got nothing instead
  exit 1
fi

git config user.email "nison.mael+yarnbot@gmail.com"
git config user.name "Friendly Yarn Bot"

git checkout -b commit-wip
git remote add yarnbot https://yarnbot:"${GITHUB_TOKEN}"@github.com/"${GITHUB_REPOSITORY}".git
git add .
git commit --allow-empty -m "${INPUT_MESSAGE:-${*}}"
git pull --rebase origin master
git push yarnbot HEAD:master
