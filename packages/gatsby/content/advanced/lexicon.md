---
category: advanced
path: /advanced/lexicon
title: "Lexicon"
---

```toc
# This code block gets replaced with the Table of Contents
```

<!-- Note that all entries within this file must be alphabetically sorted -->

### Build Scripts

Refers to tasks executed right after the packages got installed; typically the `postinstall` scripts configured in the [`scripts` field](/configuration/manifest#scripts) from the manifest.

Build scripts should be left to native dependencies, there is virtually no reason for pure JavaScript packages to use them. They have [significant side effects](/advanced/lifecycle-scripts#a-note-about-postinstall) on your user's projects, so weight carefully whether you really need them.

See also: [Lifecycle Scripts](/advanced/lifecycle-scripts)

### Dependency

A dependency (listed in the [`dependencies` field](/configuration/manifest#dependencies) of the manifest) describes a relationship between two packages.

When a package A has a dependency B, Yarn guarantees that A will be able to access B if the install is successful. Note that this is the only promise we make regarding regular dependencies: in particular, there is no guarantee that package B will be the same version than the one used in other parts of the application.

See also: [Development Dependency](#development-dependency)

See also: [Peer Dependency](#peer-dependency)

### Descriptor

A descriptor is a combination of a package name (for example `lodash`) and a package <abbr>range</abbr> (for example `^1.0.0`). Descriptors are used to identify a set of packages rather than one unique package.

### Development Dependency

A dependency (listed in the [`devDependencies` field](/configuration/manifest#devDependencies) of the manifest) describes a relationship between two packages.

Development dependencies are very much like regular dependencies except that they only matter for local packages. Packages fetched from remote registries such as npm will not be able to access their development dependencies, but packages installed from local sources (such as [workspaces](#workspaces) or the [`portal:` protocol](#portals)) will.

See also: [Dependency](#dependency)

See also: [Peer Dependency](#peer-dependency)

### Fetcher

Fetchers are the components tasked with extracting the full package data from a <abbr>reference</abbr>. For example, the npm fetcher would download the package tarballs from the npm registry.

See also: [Architecture](/advanced/architecture)

See also: the [`Fetcher` interface](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Fetcher.ts#L34)

### Linker

Linkers are the components that consume both a dependency tree and a store of package data, and generate in return disk artifacts specific to the environment they target. For example, the <abbr>Plug'n'Play</abbr> linker generates a single `.pnp.js` file.

See also: [Architecture](/advanced/architecture)

See also: the [`Linker` interface](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Linker.ts#L28)

See also: the [`Installer` interface](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Installer.ts#L18)

### Locator

A locator is a combination of a package name (for example `lodash`) and a package <abbr>reference</abbr> (for example `1.2.3`). Locators are used to identify a single unique package (interestingly, all valid locators also are valid <abbr>descriptors</abbr>).

### Manifest

A manifest is a `package.json` file.

### Monorepository

A monorepository is a repository that contains multiple packages. For example, [Babel](https://github.com/babel/babel/tree/master/packages) and [Jest](https://github.com/facebook/jest/tree/master/packages) are examples of such repositories - they each contain dozen of small packages that each rely on one another.

See also: [Workspaces](/features/workspaces)

### Peer dependency

A dependency (listed in the [`peerDependencies` field](/configuration/manifest#peerDependencies) of the manifest) describes a relationship between two packages.

Contrary to regular dependencies, a package A with a peer dependency on B doesn't guarantee that A will be able to access B - it's up to the package that depends on A to manually provide a version of B compatible with request from A. This drawback has a good side too: the package instance of B that A will access is guaranteed to be the exact same one as the one used by the ancestor of A. This matters a lot when B uses `instanceof` checks or singletons.

See also: [Development Dependencies](#development-dependencies)
See also: [Peer Dependency](#peer-dependency)
See also: [Singleton Package](#singleton-package)

### Peer-dependent Package

A peer-dependent package is a package that lists peer dependencies.

See also: [Virtual Packages](#virtual-package)

### Plugin

Plugins are a new concept introduced in Yarn 2+. Through the use of plugins, Yarn can be extended and made even more powerful - whether it's through the addition of new <abbr>resolvers</abbr>, <abbr>fetchers</abbr>, or <abbr>linkers</abbr>.

See also: [Plugins](/features/plugins)
See also: the [`Plugin` interface](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Plugin.ts#L67)

### Plug'n'Play

Plug'n'Play is an alternative installation strategy that, instead of generating the typical `node_modules` directories, generate one single file that is then injected into Node to let it know where to find the installed packages. Starting from the v2, Plug'n'Play becomes the default installation strategy for Javascript projects.

See also: [Plug'n'Play](/features/pnp)

### PnP

See [Plug'n'Play](#plugnplay)

### Portal

A portal is a dependency that uses the `portal:` protocol, pointing to a package located on the disk.

Contrary to the `link:` protocol (which can point to any location but cannot have dependencies), Yarn will setup its dependency map in such a way that not only will the dependent package be able to access the file referenced through the portal, but the portal itself will also be able to access its own dependencies. Even peer dependencies!

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

Resolvers are the components tasked from converting <abbr>descriptors</abbr> into <abbr>locators</abbr>, and extracting the package <abbr>manifests</abbr> from the package <abbr>locators</abbr>. For example, the npm resolver would check what versions are available on the npm registry and return all the candidates that satisfy the <abbr>semver</abbr> requirements, then would query the npm registry to fetch the full metadata associated with the selected resolution.

See also: [Architecture](/advanced/architecture)
See also: the [`Resolver` interface](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Resolver.ts#L45)

### Scope

Scopes are a term linked inherited from the npm registry; they are used to describe a set of packages that all belong to the same entity. For example, all the Yarn packages related to the v2 belong to the `berry` scope on the npm registry. Scopes are traditionally prefixed with the `@` symbol.

### Singleton Package

A singleton package is a package which is instantiated a single time across the dependency tree.

While singleton packages aren't a first-class citizen, they can be easily created using [peer dependencies](#peer-dependency) by using one of their properties: since packages depended upon by peer dependencies are guaranteed to be the exact same instance as the one used by their direct ancestor, using peer dependencies across the entire dependency branch all the way up to the nearest workspace will ensure that a single instance of the package is ever created - making it a de-facto singleton package.

See also: [Peer Dependency](#peer-dependency)

### Transitive Dependency

A transitive dependency is a dependency of a package you depend on.

Imagine the case of `react`. Your application depends on it (you listed it yourself in your manifest), so it's a direct dependency. But `react` also depends on `prop-types`! That makes `prop-types` a transitive dependency, in that you don't directly declare it.

### Unplugged Package

In Yarn 2, most packages are kept within their zip archives rather than being unpacked on the disk. The archives are then mounted on the filesystem at runtime, and transparently accessed. The mounts are read-only so that the archives don't get corrupted if something tries to write into them.

In some cases, however, keeping the package read-only may be difficult (such as when a package lists postinstall scripts - the build steps will often need to generate build artifacts, making read-only folders impractical). For those situations, Yarn can unpack specific packages and keep them into their own individual folders. Such packages are referred to as "unplugged".

Packages are unplugged in two cases: either explicitly when the [`unplugged` field](/configuration/manifest#dependenciesMeta.unplugged) is set to `true`, or implicitly when the package lists postinstall scripts.

### Virtual Package

Because [peer-dependent packages](#peer-dependent-package) effectively define an *horizon* of possible dependency sets rather than a single static set of dependencies, a peer-dependent package may have multiple dependency sets. When this happens, the package will need to be instantiated at least once for each such set.

Since in Node-land the JS modules are instantiated based on their path (a file is never instantiated twice for any given path), and since PnP makes it so that packages are installed only once in any given project, the only way to instantiate those packages multiple times is to give them multiple paths while still referencing to the same on-disk location. That's where virtual packages come handy.

Virtual packages are specialized instances of the peer-dependent packages that encode the set of dependencies that this particular instance should use. Each virtual package is given a unique filesystem path that ensures that the scripts it references will be instantiated with their proper dependency set.

In the past virtual packages were implemented using symlinks, but this recently changed and they are now implemented through a virtual filesystem layer. This circumvents the need to create hundreds of confusing symlinks, improving compatibility with Windows and preventing issues that would arise with third-party tools calling `realpath`.

### Workspace

Generally speaking workspaces are a Yarn features used to work on multiple projects stored within the same repository.

In the context of Yarn's vocabulary, workspaces are packages that are of a single <abbr>project</abbr>.

See also: [Workspaces](/features/workspaces)

### Worktree

A worktree is a private workspace that adds new child workspaces to the current <abbr>project</abbr>.

See also: [Workspaces](/features/workspaces)

### Yarn

Yarn is a command line tool used to manage programming environments. Written in Javascript, it is mostly used along with other Javascript projects but has capabilities that make it suitable to be used in various situations.

### Zero-Install

See also: [Zero-Install](/features/zero-installs)
