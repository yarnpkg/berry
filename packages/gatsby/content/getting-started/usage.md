---
category: getting-started
path: /getting-started/usage
title: Usage
description: A short overview of Yarn's most used commands.
order: 3
---

Now that you have Yarn [installed](/getting-started/install), you can start using it! Here are some of the most common commands you'll need.

> **Migrating from Yarn 1**
>
> We've been compiling helpful advice when porting over from Yarn 1 on the following [Migration Guide](/getting-started/migration). Give it a look and contribute to it if you see things that aren't covered yet! Make sure to consult the [PnP Compatibility Table](/features/pnp#compatibility-table) and [enable the node-modules plugin](/getting-started/migration#if-required-enable-the-node-modules-plugin) if required!

```toc
# This code block gets replaced with the Table of Contents
```

### Accessing the list of commands

```bash
yarn help
```

### Starting a new project

```bash
yarn init
```

### Installing all the dependencies

```bash
yarn
yarn install
```

### Adding a dependency

```bash
yarn add [package]
yarn add [package]@[version]
yarn add [package]@[tag]
```

### Adding a dependency to different categories of dependencies

```bash
yarn add [package] --dev  # dev dependencies
yarn add [package] --peer # peer dependencies
```

### Upgrading a dependency

```bash
yarn up [package]
yarn up [package]@[version]
yarn up [package]@[tag]
```

### Removing a dependency

```bash
yarn remove [package]
```

### Upgrading Yarn itself

```bash
yarn set version latest
yarn set version from sources
```
