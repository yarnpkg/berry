---
category: getting-started
path: /getting-started/install
title: "2 - Installation"
---

> **Migrating from Yarn 1**
>
> We've been compiling helpful advices when porting over from Yarn 1 on the following [Migration Guide](/advanced/migration). Give it a look and contribute to it if you see things that aren't covered yet!

## Global Install

NOTE: Currently, Yarn 2 is only available to install via npm. The installation methods previously available with Yarn 1 (Windows installer, Chocolatey, Debian/Ubuntu package, Homebrew, and RPM package) will be available again soon.

1. Install [Node.js](https://nodejs.org/en/download/)

2. Install Yarn:

```bash
npm install -g yarn@berry
```

3. Test that Yarn 2 has been properly installed by running the following, which should yield "v2.0.0" or similar:

```bash
yarn --version
```

## Per-project install

1. Follow the global install instructions

2. Move into your project folder:

```bash
cd ~/path/to/project
```

3. Run the following command:

```bash
yarn policies set-version berry
```

4. Commit the `.yarn` and `.yarnrc.yml` changes
