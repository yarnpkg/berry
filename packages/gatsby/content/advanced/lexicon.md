---
category: advanced
path: /advanced/lexicon
title: "Lexicon"
---

<!-- Note that all entries within this file must be alphabetically sorted -->

### Descriptor

A descriptor is a combination of a package name (for example `lodash`) and a package <abbr>range</abbr> (for example `^1.0.0`). Descriptors are used to identify a set of packages rather than one unique package.

### Fetcher

Fetchers are the components tasked from extracting the full package data from a <abbr>reference</abbr>. For example, the npm fetcher would download the package tarballs from the npm registry.

See also: [Architecture](/advanced/architecture)
See also: the [`Fetcher` interface](https://github.com/yarnpkg/berry/blob/master/packages/berry-core/sources/Fetcher.ts#L34)

### Linker

Linkers are the components that consume both a dependency tree and a store of package data, and generate in return disk artifacts specific to the environment they target. For example, the <abbr>Plug'n'Play</abbr> linker generates a single `.pnp.js` file.

See also: [Architecture](/advanced/architecture)
See also: the [`Linker` interface](https://github.com/yarnpkg/berry/blob/master/packages/berry-core/sources/Linker.ts#L28)
See also: the [`Installer` interface](https://github.com/yarnpkg/berry/blob/master/packages/berry-core/sources/Installer.ts#L18)

### Locator

A locator is a combination of a package name (for example `lodash`) and a package <abbr>reference</abbr> (for example `1.2.3`). Locators are used to identify a single unique package (interestingly, all valid locators also are valid <abbr>descriptors</abbr>).

### Manifest

A manifest is a `package.json` file.

### Monorepository

A monorepository is a repository that contains multiple packages. For example, [Babel](https://github.com/babel/babel/tree/master/packages) and [Jest](https://github.com/facebook/jest/tree/master/packages) are examples of such repositories - they each contain dozen of small packages that each rely on one another.

See also: [Workspaces](/features/workspaces)

### Peer-dependent Package

A peer-dependent package is a package that lists peer dependencies.

See also: [Virtual Packages](#virtualpackages)

### Plugin

Plugins are a new concept introduced in Yarn 2+. Through the use of plugins Yarn can be extended and made even more powerful - whether it's through the addition of new <abbr>resolvers</abbr>, <abbr>fetchers</abbr>, or <abbr>linkers</abbr>.

See also: [Plugins](/features/plugins)
See also: the [`Plugin` interface](https://github.com/yarnpkg/berry/blob/master/packages/berry-core/sources/Plugin.ts#L67)

### Plug'n'Play

Plug'n'Play is an alternative installation strategy that, instead of generating the typical `node_modules` directories, generate one single file that is then injected into Node to let it know where to find the installed packages. Starting from the v2, Plug'n'Play became the default strategy for Javascript projects.

See also: [Plug'n'Play](/features/pnp)

### PnP

See [Plug'n'Play](#plugnplay)

### Project

The term project is used to encompass all the <abbr>worktrees</abbr> that belong to the same dependency tree.

See also: [Workspaces](/features/workspaces)

### Range

A range is a string that, when combined with a package name, can be used to select multiple versions of a single package. Ranges typically follow <abbr>semver</abbr>, but can use any of the supported Yarn protocols.

See also: [Protocols](/features/protocols)

### Reference

A reference is a string that, when combined with a package name, can be used to select one single version of a single package. References typically follow <abbr>semver</abbr>, but can use any of the supported Yarn protocols.

See also: [Protocols](/features/protocols)

### Resolver

Resolvers are the components tasked from converting <abbr>descriptors</abbr> into <abbr>locators</abbr>, and extracting the package <abbr>manifests</abbr> from the package <abbr>locators</abbr>. For example, the npm resolver would check what versions are available on the npm registry and return all the candidates that satisfy the <abbr>semver</abbr> requirements, then would query the npm registry to fetch the full metadata associated to the selected resolution.

See also: [Architecture](/advanced/architecture)
See also: the [`Resolver` interface](https://github.com/yarnpkg/berry/blob/master/packages/berry-core/sources/Resolver.ts#L43)

### Scope

Scopes are a term linked inherited from the npm registry; they are used to describe a set of packages that all belong to the same entity. For example, all the Yarn packages related to the v2 belong to the `berry` scope on the npm registry. Scopes are traditionally prefixed with the `@` symbol.

### Virtual Package

Because peer-dependent packages effectively define a *template* of possible dependencies rather than an actual static list of dependencies, a single peer-dependent package may have multiple dependency lists - in which case it'll need to be instantiated multiple times (in practice, once for each strong dependent, cf [Peer Dependencies](/advanced/peer-dependencies)).

Since in Node-land the JS modules are instantiated based on their path (a file is never instantiated twice for any given path), and since PnP makes it so that packages are installed only once in any given project, the only way to instantiate those packages multiple times is to give them multiple paths while still referencing to the same on-disk location. That's where virtual packages come handy.

Virtual packages are specialized instances of the peer-dependent packages that encode the position of the package templates in the dependency tree. Each instance is given a unique path that ensures that the scripts it references will be instantiated with their proper dependency list, regardless of the execution order.

In the past virtual packages were implemented using symlinks, but this recently changed and they are now implemented through a virtual filesystem layer. This circumvents the need to create many confusing symlinks, improves compatibility with Windows, and prevents issues when third-party tools try to call `realpath` on them.

### Workspace

Generally speaking, workspaces are a Yarn features used to work on multiple projects stored within the same repository.

In the context of Yarn's vocabulary, workspaces are packages that are of a single <abbr>project</abbr>.

See also: [Workspaces](/features/workspaces)

### Worktree

A worktree is a private workspace that adds new child workspaces to the current <abbr>project</abbr>.

See also: [Workspaces](/features/workspaces)

### Yarn

Yarn is a command line tool used to manage programming environments. Written in Javascript, it is mostly used along with others Javascript projects, but has capabilities that make it suitable to be used in various situations.

### Zero-Install

See also: [Zero-Install](/features/zero-installs)
