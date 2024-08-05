---
category: protocols
slug: /protocol/git
title: "Git Protocol"
description: How git dependencies work in Yarn.
---

The `git:` protocol fetches packages directly from a git repository. This is useful when you need to use a version of a package that has not been published to the npm registry.

```
yarn add typanion@git@github.com/arcanis/typanion.git
```

## Packing

The target repository won't be used as-is - it will first be packed using [`pack`](/cli/pack).

:::info
To be sure the output is identical to what the linked repository would look like after being published, the packing will look at its configuration to decide which package manager to use.

In other words, the project will be packed using Yarn if there's a `yarn.lock`, npm if there's a `package-lock.json`, or pnpm if there's a `pnpm-lock.yaml`.
:::

## Commit pinning

You can explicitly request a tag, commit, branch, or semver tag, by using one of those keywords (if you're missing the keyword, Yarn will look for the first thing that seems to match, as in prior versions):

```
git@github.com:yarnpkg/berry.git#tag=@yarnpkg/cli/2.2.0
git@github.com:yarnpkg/berry.git#commit=a806c88
git@github.com:yarnpkg/berry.git#head=master
```

## Workspaces support

Workspaces can be cloned as long as the remote repository uses Yarn (or npm, in which case npm@>=7.x has to be installed on the system):

```
git@github.com:yarnpkg/berry.git#workspace=@yarnpkg/shell&tag=@yarnpkg/shell/2.1.0
```

:::warning
Not all package managers support installing workspaces from git repositories; you shouldn't rely on this feature in your `dependencies` field if your package is meant to be published.
:::
