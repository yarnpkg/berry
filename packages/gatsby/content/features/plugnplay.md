---
category: features
path: /features/pnp
title: "Plug'n'Play"
---

Unveiled in September 2018, Plug'n'Play is an alternative installation strategy for Node. Based on prior works from other languages, it presents interesting characteristics that build upon the regular commonjs `require` workflow in a completely backward-compatible way.

## The node_modules problem

The way installs used to work was simple: Yarn generated a `node_modules` directory that Node was then able to consume thanks to its builtin Node Resolution Algorithm. In this context, Node didn't had to know the first thing about what being a package was: it only reasoned in terms of files. "Does this file exists here? No? Let's look in the parent `node_modules` then. Does it exists here? Still no? Too bad... let's keep going until we find the right one!". This process was vastly inefficient for a lot of reasons:

- The `node_modules` directories typically contained gargantuan amounts of files. Generating them could make up for more than 70% of the time needed to run `yarn install` - the effects being amplified when operating with warm caches.

- Because the `node_modules` generation was I/O bound, package managers couldn't really optimize it a lot either - we could use hardlinks or copy-on-write, but even then we still needed to make a bunch of syscalls that slowed us down dramatically.

- Because Node had no concept of "package", it didn't know whether a file was _meant_ to be accessed (rather than simply being available through hoisting). It was entirely possible that the code you wrote worked one day in development but broke in production because you forgot to list one of your dependencies in your `package.json`.

- Even at runtime, the Node resolution had to make a bunch of `stat` and `readdir` calls in order to figure out from where to load every single required file. It was extremely wasteful, and was part of why booting Node applications took so much time.

- Finally, the very design of the `node_modules` folder was impractical in that it didn't allow package managers to properly dedupe packages. Even though we designed algorithms allowing us to optimize parts of the tree, we still ended up unable to optimize some particular patterns - causing not only the disk to take more space than needed, but also some packages to be instantiated multiple times in memory.

## Fixing node_modules

When you think about it, Yarn knows everything about your dependency tree - you even ask it to install it for you! So why did we let Node locate our packages on the disk? Why didn't we simply tell Node where to find the Yarn package, and inform it that any require call to X by Y was meant to read files from a specific location? This is from this postulate that Plug'n'Play was created.

In this install mode (now the default starting from Yarn v2), Yarn generates a single `.pnp.js` file instead of the usual `node_modules`. Instead of containing the source code of the installed packages, the `.pnp.js` file contains a map linking a package name and version to a location on the disk, and another map linking a package name and version to its set of dependencies. Thanks to this efficient system, Node can directly know where to look for files being required - regardless who asks for them!

This approach as various benefits:

- Since we only need to generate a single text file instead of tens of thousands, installs are now pretty much instantaneous - their only bottleneck now is the number of dependencies in your project.

- Since we aren't supported by a filesystem hierarchy anymore, we can both guarantee a perfect optimization and predictable package instantiations.

- The generated file can be checked into the repository as part of the [Zero-Installs](/features/zero-installs) effort, making your production systems stabler than ever.

- Programs start faster, because the Node resolution doesn't have to iterate over the filesystem hierarchy nearly as much as before (and soon won't have to do it at all!).

## Caveats and work-in-progress

During the years that led to Plug'n'Play being designed and adopted as main install strategy, various projects came up with their own implementation of the Node Resolution Algorithm - usually to circumvent shortcomings of the `require.resolve` API. Such projects can be Webpack (enhanced-resolve), Babel (resolve), Jest (jest-resolve), Metro (metro-resolver), ...

The following compatibility table gives you an idea of the integration status with various tools from the community. Note that only CLI tools are listed there, as frontend libraries (such as `react`, `vue`, `lodash`, ...) don't reimplement the Node resolution and as such don't need any special logic to take advantage from Plug'n'Play:

| Project name | Status | Note |
| ------------ | ------ | ---- |
| Webpack           | Plugin  | Via [pnp-webpack-plugin](https://github.com/arcanis/pnp-webpack-plugin) |
| Babel             | Native  | Starting from |
| Jest              | Native  | Starting from 24.1+ |
| Gatsby            | Native  | Starting from |
| Create-React-App  | Native  | Starting from 2.0+ |
| ESLint            | Partial | Check [the investigation thread]() for more info |
| React Native      | Partial | Doesn't support native modules |
