---
category: advanced
slug: /advanced/architecture
title: "Architecture"
description: An overview of Yarn's architecture.
---

## General architecture

Yarn works through a core package (published as `@yarnpkg/core`) that exposes the various base components that make up a project. Some of the components are classes that you might recognize from the API: `Configuration`, `Project`, `Workspace`, `Cache`, `Manifest`, and others. All those are provided by the core package.

The core itself doesn't do much - it merely contains the logic required to manage a project. In order to use this logic from the command-line Yarn provides an indirection called `@yarnpkg/cli` which, interestingly, doesn't do much either. It however has two very important responsibilities: it hydrates a project instance based on the current directory (`cwd`), and inject the prebuilt Yarn plugins into the environment.

See, Yarn is built in modular way that allow most of the business logic related to third-party interactions to be externalized inside their own package - for example the [npm resolver](https://github.com/yarnpkg/berry/tree/master/packages/plugin-npm) is but one plugin amongst many others. This design gives us a much simpler codebase to work with (hence an increased development speed and stabler product), and offers plugin authors the ability to write their own external logic without having to modify the Yarn codebase itself.

## Install architecture

What happens when running `yarn install` can be summarized in a few different steps:

1. First we enter the "resolution step":

    - First we load the entries stored within the lockfile, then based on those data and the current state of the project (that it figures out by reading the manifest files, aka `package.json`) the core runs an internal algorithm to find out which entries are missing.

    - For each of those missing entries, it queries the plugins using the [`Resolver`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Resolver.ts) interface, and asks them whether they would know about a package that would match the given descriptor ([`supportsDescriptor`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Resolver.ts#L54)) and its exact identity ([`getCandidates`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Resolver.ts#L114)) and transitive dependency list ([`resolve`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Resolver.ts#L123)).

    - Once it has obtained a new list of package metadata, the core starts a new resolution pass on the transitive dependencies of the newly added packages. This will be repeated until it figures out that all packages from the dependency tree now have their metadata stored within the lockfile.

    - Finally, once every package range from the dependency tree has been resolved into metadata, the core builds the tree in memory one last time in order to generate what we call "virtual packages". In short, those virtual packages are split instances of the same base package - we use them to disambiguate all packages that list peer dependencies, whose dependency set would change depending on their location in the dependency tree (consult [this lexicon entry](/advanced/lexicon#virtualpackages) for more information).

2. Once the resolution is done, we enter the "fetch step":

    - Now that we have the exact set of packages that make up our dependency tree, we iterate over it and for each of them we start a new request to the cache to know whether the package is anywhere to be found. If it isn't we do just like we did in the previous step and we ask our plugins (through the [`Fetcher`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Fetcher.ts) interface) whether they know about the package ([`supports`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Fetcher.ts#L43)) and if so to retrieve it from whatever its remote location is ([`fetch`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Fetcher.ts#L67)).

    - Interesting tidbit regarding the fetchers: they communicate with the core through an abstraction layer over `fs`. We do this so that our packages can come from many different sources - it can be from a zip archive for packages downloaded from a registry, or from an actual directory on the disk for [`portal:`](/protocol/portal) dependencies.

3. And finally, once all the packages are ready for consumption, comes the "link step":

    - In order to work properly, the packages you use must be installed on the disk in some way. For example, in the case of a native Node application, your packages would have to be installed into a set of `node_modules` directories so that they could be located by the interpreter. That's what the linker is about. Through the [`Linker`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Linker.ts) and [`Installer`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-core/sources/Installer.ts) interfaces the Yarn core will communicate with the registered plugins to let them know about the packages listed in the dependency tree, and describe their relationships (for example it would tell them that `tapable` is a dependency of `webpack`). The plugins can then decide what to do of this information in whatever way they see fit.

    - Doing this means that new linkers can be created for other programming languages pretty easily - you just need to write your own logic regarding what should happen from the packages provided by Yarn. Want to generate an `__autoload.php`? Do it! Want to setup a Python virtual env? No problem!

    - Something else that's pretty cool is that the packages from within the dependency tree don't have to all be of the same type. Our plugin design allows instantiating multiple linkers simultaneously. Even better - the packages can depend on one another across linkers! You could have a JavaScript package depending on a Python package (which is technically the case of `node-gyp`, for example).
