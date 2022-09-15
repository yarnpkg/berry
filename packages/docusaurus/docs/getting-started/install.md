---
category: getting-started
path: /getting-started/install
title: Installation
description: Yarn's in-depth installation guide.
order: 2
---

## Install Corepack

The preferred way to manage Yarn is through [Corepack](https://nodejs.org/dist/latest/docs/api/corepack.html), a new binary shipped with all Node.js releases starting from 16.10. It acts as an intermediary between you and Yarn, and lets you use different package manager versions across multiple projects without having to check-in the Yarn binary anymore.

### Node.js >=16.10

Corepack is included by default with all Node.js installs, but is currently opt-in. To enable it, run the following command:

```bash
corepack enable
```

### Node.js <16.10

Corepack isn't included with Node.js in versions before the 16.10; to address that, run:

```bash
npm i -g corepack
```

## Activate Yarn

```bash
corepack prepare yarn@stable --activate
```

## Initializing your project

Just run the following command. It will generate some files inside your current directory; add them all to your next commit, and you'll be done!

```bash
yarn init -2
```

> **Note:** By default, `yarn init -2` will setup your project to be compatible with [Zero-Installs](/features/zero-installs), which requires checking-in your cache in your repository; check your [`.gitignore`](/getting-started/qa#which-files-should-be-gitignored) if you wish to disable this.

> **Note:** In case you're migrating from Yarn 1.x and hit a blocker, you might want to take a look at our [Migration Guide](/getting-started/migration). It isn't always needed, but a fairly comprehensive resource of how to solve issues that may arise in the transition.

## Updating to the latest versions

Any time you'll want to update Yarn to the latest version, just run:

```bash
yarn set version stable
```

Yarn will then configure your project to use the most recent stable binary. Don't forget to run a new install to update your artifacts before committing the results!

## Installing the latest build fresh from master

From time to time even the most recent releases aren't enough, and you then will want to try out the very latest master branch to check if a bug has been fixed. This has become very simple! Just run the following command:

```bash
yarn set version from sources
```

Similarly, specific PRs can be installed using the `--branch` flag:

```bash
yarn set version from sources --branch 1211
```
