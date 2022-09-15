---
category: getting-started
path: /getting-started/recipes
title: "Recipes"
description: Various cool things you can do with Yarn 2
---

## TypeScript + PnP quick start:

- Initialize the repo using Yarn 2:
```sh
yarn init -2
```

- Add typescript and enable [VSCode integration](/getting-started/editor-sdks):
```sh
yarn add --dev typescript
yarn dlx @yarnpkg/sdks vscode
```

- You can optionally enable [Yarn's TypeScript plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript), which helps manage `@types/*` dependencies automatically.
```sh
yarn plugin import typescript
```

## Running a Yarn CLI command in the specified directory:

- Starting a new library inside a monorepo directly, without manually creating directories for it.
```sh
yarn packages/my-new-lib init
```
- Running an arbitrary command inside a specific workspace:
```sh
yarn packages/app tsc --noEmit
```

## Hybrid PnP + node_modules mono-repo:

You may sometimes need to use `node_modules` on just part of your workspace (for example, if you use React-Native).

- Create a separate directory for the `node_modules` project.
```sh
mkdir nm-packages/myproj
```
- Create an empty lockfile in the new project. Yarn uses lockfiles to locate the root of projects.
```sh
touch nm-packages/myproj/yarn.lock
```
- Add a `.yarnrc.yml` file inside the new directory that enables `node_modules` just for it (`nm-packages/myproj/.yarnrc.yml`):
```yml
nodeLinker: node-modules
```
- Add a PnP ignore pattern for this path in your main `.yarnrc.yml` at the root of your monorepo:
```yml
pnpIgnorePatterns:
  - ./nm-packages/**
```
- Run `yarn` to apply `pnpIgnorePatterns` in the repo root.
- Run `cd nm-packages/myproj && yarn` to install the now isolated project.
