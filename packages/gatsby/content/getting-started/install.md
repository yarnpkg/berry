---
category: getting-started
path: /getting-started/install
title: "2 - Installation"
---

> **Migrating from Yarn 1**
>
> We've been compiling helpful advices when porting over from Yarn 1 on the following [Migration Guide](/advanced/migration). Give it a look and contribute to it if you see things that aren't covered yet!

## Global Install

Installing Yarn 2.x globally is discouraged as we're moving to a per-project install strategy. We advise you to keep Yarn 1.x (Classic) as your global binary by installing it via the instructions you can find [here](https://classic.yarnpkg.com/en/docs/install).

Once you've followed the instructions (running `yarn --version` from your home directory should yield something like `1.22.0`), go to the next section to see how to enable Yarn 2 on your project.

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

4. Commit the `.yarn` and `.yarnrc.yml` changes

## Installing the latest build fresh from master

1. Follow the per-project install instructions

2. Run the following comand (add `--no-minify` if you want an unminified build):

```bash
yarn set version from sources
```
