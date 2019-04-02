---
category: advanced
path: /advanced/architecture
title: "Architecture"
---

## General architecture

Yarn works through a core package (published as `@berry/core`) that exposes the various base component that make up a project. Some classes that you might recognize: `Configuration`, `Project`, `Workspace`, `Cache`, `Manifest`, ... all come from the core package.

In order to use the core from the command-line, an indirection layer exists. This layer is called `@berry/cli`, and it doesn't really do much - its main responsibility is to simply delegate the command-line invocations to an instance of [`clipanion`](https://github.com/arcanis/clipanion), the CLI framework we use in Yarn. It does something else very important, though: it loads the Yarn plugins.

See, Yarn is built in such a way that most of the logic specific to an environment can be extracted inside its own package. It gives us a more decoupled codebase to work on, and gives you the ability to write your own logic without having to modify the Yarn codebase itself. We went pretty far with this design, and as of now plugins can do many things (check the dedicated page for more information). Even the [npm registry logic]() is just one of our plugins, even if shipped by default!

## Install architecture

When running `yarn install`, what happens? It can be summarized in a few different steps:

- First we enter the "resolution step":

  - We load the entries stored in the lockfile.

  - Then the core executes an algorithm to find out which entries are missing. Again, this is implemented directly within the core (`@berry/core`) in a generic way. Plugins don't need to care about the specifics at this time.

  - For each of those missing entries, it will query the plugins using the [`Resolver`]() interface, and will ask then whether they know about a package that would match the given descriptor (`supportsDescriptor`) and, if it's the case, its exact identity (`getCandidates`) and transitive dependency list (`resolve`).

  - And we do that again until the whole dependency tree is ready to move on to the next step.

- After resolution comes the "fetch step":

  - This one really isn't hard - we simply iterate over the list of packages that are part of the dependency tree and, for each of them, we check whether they are already on disk or not. If they aren't, we download them from their remote location and store them within our cache.

  - Similar to how we ask the plugins for information regarding our dependency tree, we also ask them to fetch the packages from their remote location through the [`Fetcher`]() interface.

  - Interesting tidbit regarding the fetchers: they communicate with the core through an abstraction layer over `fs`. We do this so that our packages can come from many different sources - it can be from a zip archive for packages downloaded from a registry, or from an actual directory on the disk for [`portal:`]() dependencies.

- Then comes the "link step". That's when things start to get interesting:

  - In order to work properly, the packages you use must be installed on the disk in some way. For example, in the case of native Node, your packages would have to be installed into `node_modules` directories so that they can be located by the interpreter. That's what the linker is about. Through the `Linker` and `Installer` interfaces the Yarn core (still `@berry/core`) will communicate with the registered plugins to let them know about the packages listed in the dependency tree, and how they are related (for example telling it that `tapable` is a dependency of `webpack`).

  - Doing this means that new linkers can be created for other programming languages pretty easily - you just need to write your own logic regarding what should happen from the packages provided by Yarn. Want to generate an `__autoload.php`? Do it! Want to setup a Python virtual env? No problemo!

  - Something else that's pretty cool is that the packages from within the dependency tree don't have to all be of the same type. Our plugin design allows instantiating multiple linkers simultaneously. Even better - the packages can depend on one another across linkers! You could have a JavaScript package depending on a Python package (which is technically the case of `node-gyp`, for example).
