---
category: getting-started
path: /getting-started/install
title: "2 - Installation"
description: Yarn's in-depth installation guide.
---

## Installing Yarn 2

The recommended way to install and use the Yarn 2 command-line interface (CLI) is through [Corepack](https://github.com/nodejs/corepack/blob/main/README.md).

> <img src="https://github.com/nodejs/corepack/raw/main/icon.svg" height="15" /> Corepack is a zero-runtime-dependency Node script that acts as a bridge between Node projects and the package managers they are intended to be used with during development. In practical terms, Corepack will let you use Yarn without having to install it - just like what currently happens with npm, which is shipped by Node by default.
 
To start, uninstall the global `yarn` binary. Then, install `corepack`. Don't worry, your existing v1 yarn projects will continue to work just like before.

```
npm uninstall -g yarn
npm install -g corepack
```

**That's it!** From now on, running `yarn init` will generate a Yarn 2 project. 

Note that once you've followed the instructions, running `yarn --version` from your home directory should yield something like `1.22.0`. This is expected. Yarn 2 and later versions are meant to be managed on a by-project basis.

> Using a single package manager across your system has always been a problem. To be stable, installs need to be run with the same package manager version across environments, otherwise there's a risk we introduce accidental breaking changes between versions - after all, that's why the concept of lockfile was introduced in the first place! And with Yarn being in a sense your very first project dependency, it should make sense to "lock it" as well.

> One perk of this system is that projects configured for Yarn 1 will keep working just like before. We wouldn't have had to do this if Yarn had been "project locked" from the beginning, but [hindsight is 20/20](https://en.wiktionary.org/wiki/hindsight_is_20/20) 😉

> **Migrating from Yarn 1**

In order to migrate an existing Yarn 1 project to Yarn 2, run `yarn set version berry`

> We've been compiling helpful advice when porting over from Yarn 1 on the following [Migration Guide](/getting-started/migration). Give it a look and contribute to it if you see things that aren't covered yet! Make sure to consult the [PnP Compatibility Table](/features/pnp#compatibility-table) and [enable the node-modules plugin](/getting-started/migration#if-required-enable-the-node-modules-plugin) if required!

```toc
# This code block gets replaced with the Table of Contents
```

## See: [Which files should be gitignored?](/getting-started/qa#which-files-should-be-gitignored)

## Updating to the latest version

Should you later want to update Yarn to the latest version, just run:

```bash
yarn set version latest
```

Yarn will then download the most recent binary from our website, and install it in your project. 

Don't forget to run a `yarn install` to update your artifacts, and to commit the results!

## Installing the latest build fresh from master

From time to time even the most recent "stable" releases are not enough. 

If you want to try out the very latest version, straight from the latest commit in our repository, this is now easier than ever with Yarn 2! 

Just run the following command:

```bash
yarn set version from sources
```

Similarly, specific PRs can be installed using the `--branch` flag:

```bash
yarn set version from sources --branch 1211
```
