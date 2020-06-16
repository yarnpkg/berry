---
category: getting-started
path: /getting-started/install
title: "2 - Installation"
---

> **Migrating from Yarn 1**
>
> We've been compiling helpful advice when porting over from Yarn 1 on the following [Migration Guide](/advanced/migration). Give it a look and contribute to it if you see things that aren't covered yet! Make sure to consult the [PnP Compatibility Table](/features/pnp#compatibility-table) and [enable the node-modules plugin](/advanced/migration#if-required-enable-the-node-modules-plugin) if required!

```toc
# This code block gets replaced with the Table of Contents
```

## Global Install

Using a single package manager across your system has always been a problem. To be stable, installs need to be run with the same package manager version across environments, otherwise there's a risk we introduce accidental breaking changes between versions - after all, that's why the concept of lockfile was introduced in the first place! And with Yarn being in a sense your very first project dependency, it should make sense to "lock it" as well.

For this reason, Yarn 2 and later are meant to be managed on a by-project basis. Don't worry, little will change! Just make sure to first install the global Yarn binary that we will use to spawn the local ones:

```
npm install -g yarn
```

Once you've followed the instructions (running `yarn --version` from your home directory should yield something like `1.22.0`), go to the next section to see how to actually enable Yarn 2 on your project.

> You've probably remarked the global Yarn is from the "Classic" line (1.x). This is expected! One extra perk of this system is that projects configured for Yarn 1 will keep using it instead of suddenly having to migrate to the 2.x configuration format. We wouldn't have had to do this if Yarn had been "project locked" from the beginning, but [hindsight is 20/20](https://en.wiktionary.org/wiki/hindsight_is_20/20) 😉

## Per-project install

1. Follow the global install instructions

2. Move into your project folder:

```bash
cd ~/path/to/project
```

3. Run the following command:

```bash
yarn policies set-version berry # below v1.22
yarn set version berry          # on v1.22+
```

> "Berry" is the codename for the Yarn 2 release line. It's also the name of our [repository](https://github.com/yarnpkg/berry)!

4. Commit the `.yarn` and `.yarnrc.yml` changes

## Updating to the latest versions

Should you later want to update Yarn to the latest version, just run:

```bash
yarn set version latest
```

Yarn will then download the most recent binary from our website, and install it in your projects. Don't forget to run a new install to update your artifacts, and to commit the results!

## Installing the latest build fresh from master

From time to time even the most recent releases aren't enough, and you then will want to try out the very latest master to check if a bug has been fixed. This has become very simple with Yarn 2! Just run the following command:

```bash
yarn set version from sources
```

Similarly, specific PRs can be installed using the `--branch` flag:

```bash
yarn set version from sources --branch 1211
```
