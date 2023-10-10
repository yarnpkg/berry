---
category: getting-started
slug: /getting-started/recipes
title: "Recipes"
description: Various cool things you can do with Yarn 2
---

## TypeScript + PnP quick start:

- Initialize the repo using Yarn 2:

```
yarn init -2
```

- Add typescript and enable [VSCode integration](/getting-started/editor-sdks):

```
yarn add --dev typescript
yarn dlx @yarnpkg/sdks vscode
```

## Running a Yarn CLI command in the specified directory:

- Starting a new library inside a monorepo directly, without manually creating directories for it.
```
yarn packages/my-new-lib init
```
- Running an arbitrary command inside a specific workspace:
```
yarn packages/app tsc --noEmit
```

## Hybrid PnP + node_modules mono-repo:

You may sometimes need to use `node_modules` on just part of your workspace (for example, if you use React-Native).

- Create a separate directory for the `node_modules` project.
```
mkdir nm-packages/myproj
touch nm-packages/myproj/yarn.lock
```
- Enable the `node-modules` linker :
```
yarn --cwd packages/myproj config set nodeLinker node-modules
```
- Add a PnP ignore pattern for this path in your main `.yarnrc.yml` at the root of your monorepo:
```yml
pnpIgnorePatterns:
  - ./nm-packages/**
```
- Run `yarn install` to apply `pnpIgnorePatterns` in the repo root.
- Run `cd nm-packages/myproj && yarn` to install the now isolated project.
