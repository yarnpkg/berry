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
yarn --help
```

### Starting a new project

```
yarn init
```

### Adding a dependency

```
yarn add [package]
yarn add [package]@[version]
yarn add [package]@[tag]
```

### Adding a dependency to different categories of dependencies

Add to respectively [`devDependencies`](/configuration/manifest#devDependencies) or [`peerDependencies`](/configuration/manifest#peerDependencies):

```
yarn add [package] --dev
yarn add [package] --peer
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

### Installing all the dependencies of project

```
yarn install
```

The `install` keyword is optional; just calling `yarn` will have the same effect.

### Upgrading Yarn itself

```
yarn set version from sources
```
