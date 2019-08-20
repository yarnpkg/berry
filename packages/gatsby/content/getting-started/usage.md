---
category: getting-started
path: /getting-started/usage
title: "3 - Usage"
---

Now that you have Yarn [installed](/getting-started/install), you can start using Yarn. Here are some of the most common commands you'll need.

> **Migrating from Yarn 1**
>
> We've been compiling helpful advices when porting over from Yarn 1 on the following [Migration Guide](/advanced/migration). Give it a look and contribute to it if you see things that aren't covered yet!

### Accessing the list of commands

```
yarn help
```

### Starting a new project

```
yarn init
```

### Installing all the dependencies

```
yarn
yarn install
```

### Adding a dependency

```
yarn add [package]
yarn add [package]@[version]
yarn add [package]@[tag]
```

### Adding a dependency to different categories of dependencies

```
yarn add [package] --dev  # dev dependencies
yarn add [package] --peer # peer dependencies
```

### Upgrading a dependency

```
yarn up [package]
yarn up [package]@[version]
yarn up [package]@[tag]
```

### Removing a dependency

```
yarn remove [package]
```

### Upgrading Yarn itself

```
yarn set version from sources
```
