---
category: features
path: /features/pnp
title: "Plug'n'Play"
---

Unveiled in September 2018, Plug'n'Play is a new innovative installation strategy for Node. Based on prior works from other languages (for example [autoload](https://getcomposer.org/doc/04-schema.md#autoload) from PHP), it presents interesting characteristics that build upon the regular commonjs `require` workflow in an almost completely backward-compatible way.

## The node_modules problem

The way installs used to work was simple: when running `yarn install` Yarn would generate a `node_modules` directory that Node was then able to consume thanks to its builtin [Node Resolution Algorithm](https://nodejs.org/api/modules.html#modules_all_together). In this context, Node didn't have to know the first thing about what a "package" was: it only reasoned in terms of files. "Does this file exist here? No? Let's look in the parent `node_modules` then. Does it exist here? Still no? Too bad...", and it kept going until it found the right one. This process was vastly inefficient, and for a lot of reasons:

- The `node_modules` directories typically contained gargantuan amounts of files. Generating them could make up for more than 70% of the time needed to run `yarn install`. Even having preexisting installations wouldn't save you, as package managers still had to diff the existing `node_modules` with what it should have been.

- Because the `node_modules` generation was an I/O-heavy operation, package managers didn't have a lot of leeway to optimize it much further than just doing a simple file copy - and even though we could have used hardlinks or copy-on-write when possible, we would still have needed to diff the current state of the filesystem before making a bunch of syscalls to manipulate the disk.

- Because Node had no concept of packages, it also didn't know whether a file was _meant_ to be accessed (versus being available by the sheer virtue of hoisting). It was entirely possible that the code you wrote worked one day in development but broke later in production because you forgot to list one of your dependencies in your `package.json`.

- Even at runtime, the Node resolution had to make a bunch of `stat` and `readdir` calls to figure out where to load every single required file from. It was extremely wasteful, and was part of why booting Node applications took so much time.

- Finally, the very design of the `node_modules` folder was impractical in that it didn't allow package managers to properly dedupe packages. Even though some algorithms could be employed to optimize the tree layout (hoisting), we still ended up unable to optimize some particular patterns - causing not only the disk usage to be higher than needed, but also some packages to be instantiated multiple times in memory.

## Fixing node_modules

When you think about it, Yarn already knows everything there is to know about your dependency tree - it even installs it on the disk for you. So the question becomes: why do we leave it to Node to locate the packages? Why don't we simply tell Node where to find them, and inform it that any require call to X by Y was meant to access the files from a specific set of dependencies? It's from this postulate that Plug'n'Play was created.

In this install mode (now the default starting from Yarn v2), Yarn generates a single `.pnp.js` file instead of the usual `node_modules`. Instead of containing the source code of the installed packages, the `.pnp.js` file contains a map linking a package name and version to a location on the disk, and another map linking a package name and version to its set of dependencies. Thanks to this efficient system, Yarn can tell Node exactly where to look for files being required - regardless of who asks for them!

This approach has various benefits:

- Since we only need to generate a single text file instead of tens of thousands, installs are now pretty much instantaneous - the main bottleneck becomes the number of dependencies in your project rather than your disk performance.

- Installs are more stable and reliable due to reduced I/O operations, which are prone to fail (especially on Windows, where writing and removing files in batch may trigger various unintended interactions with Windows Defender and similar tools).

- Perfect optimization of the dependency tree (aka perfect hoisting) and predictable package instantiations.

- The generated .pnp.js file can be committed to your repository as part of the [Zero-Installs](/features/zero-installs) effort, removing the need to run `yarn install` in the first place.

- Faster application startup, because the Node resolution doesn't have to iterate over the filesystem hierarchy nearly as much as before (and soon won't have to do it at all!).

## PnP `loose` mode

Because the hoisting heuristics aren't standardized and predictable, PnP operating under strict mode will prevent packages to require dependencies that they don't explicitly list (even if one of their others dependencies happens to depend on it). This may cause issues with some packages.

To address this problem, Yarn ships with a "loose" mode which will cause the PnP linker to work in tandem with the `node-modules` hoister - we will first generate the list of packages that would have been hoisted to the top-level in a typical `node_modules` install, then remember this list as what we call the "fallback pool".

> Note that because the loose mode directly calls the `node-modules` hoister, it follows the exact same implementation as the true algorithm used by the [`node-modules` linker](https://github.com/yarnpkg/berry/tree/master/packages/plugin-node-modules)!

At runtime, packages that require unlisted dependencies will still be allowed to access them if any version of the dependency ended up in the fallback pool (which packages exactly are allowed to rely on the fallback pool can be tweaked with [pnpFallbackMode](/configuration/yarnrc#pnpFallbackMode)).

Note that the content of the fallback pool is undetermined - should a dependency tree contains multiple versions of a same package, there's no telling which one will be hoisted to the top-level! For this reason, a package accessing the fallback pool will still generate a warning (via the [process.emitWarning](https://nodejs.org/api/process.html#process_process_emitwarning_warning_type_code_ctor) API).

This mode is an in-between between the `strict` PnP linker and the `node_modules` linker. For now, the `strict` mode will remain the default, but once the `2.1` release will be tagged, the `loose` mode will be expected to become the new default.

In order to enable `loose` mode, make sure that the [`nodeLinker`](/configuration/yarnrc#nodeLinker) option is set to `pnp` (the default) and add the following into your local [`.yarnrc.yml`](/configuration/yarnrc) file:

```yaml
pnpMode: loose
```

[More information about the `pnpMode` option.](/configuration/yarnrc#pnpMode)

## Caveats and work-in-progress

Over the years that led to Plug'n'Play being designed and adopted as the main install strategy, various projects came up with their own implementation of the Node Resolution Algorithm - usually to circumvent shortcomings of the `require.resolve` API. Such projects can be Webpack (`enhanced-resolve`), Babel (`resolve`), Jest (`jest-resolve`), Metro (`metro-resolver`), ...

### Compatibility Table

The following compatibility table gives you an idea of the integration status with various tools from the community. Note that only CLI tools are listed there, as frontend libraries (such as `react`, `vue`, `lodash`, ...) don't reimplement the Node resolution and as such don't need any special logic to take advantage of Plug'n'Play:

**[Suggest an addition to this table](https://github.com/yarnpkg/berry/edit/master/packages/gatsby/content/features/plugnplay.md)**

| Project name                    | Status          | Note                                                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Babel                           | Native          | Starting from `resolve` 1.9+                                                                                                                                                                                                                                                                        |
| Create-React-App                | Native          | Starting from 2.0+                                                                                                                                                                                                                                                                                  |
| ESLint                          | Native          | Some compatibility issues w/ shared configs                                                                                                                                                                                                                                                         |
| Gatsby                          | Native          | No comment                                                                                                                                                                                                                                                                                          |
| Husky                           | Native          | Starting from 4.0.0-1+                                                                                                                                                                                                                                                                              |
| Jest                            | Native          | Starting from 24.1+                                                                                                                                                                                                                                                                                 |
| Prettier                        | Native          | Starting from 1.17+                                                                                                                                                                                                                                                                                 |
| Rollup                          | Native          | Starting from `resolve` 1.9+                                                                                                                                                                                                                                                                        |
| TypeScript-ESLint               | Native          | Starting from 2.12+                                                                                                                                                                                                                                                                                 |
| WebStorm                        | Native          | Starting from 2019.3+; See [Editor SDKs](https://yarnpkg.com/advanced/editor-sdks)                                                                                                                                                                                                                  |
| TypeScript                      | Transparent     | Via [`plugin-compat`](https://github.com/yarnpkg/berry/tree/master/packages/plugin-compat) (enabled by default)                                                                                                                                                                                     |
| VSCode-ESLint                   | Plugin          | Follow [Editor SDKs](https://yarnpkg.com/advanced/editor-sdks)                                                                                                                                                                                                                                      |
| VSCode                          | Plugin          | Follow [Editor SDKs](https://yarnpkg.com/advanced/editor-sdks)                                                                                                                                                                                                                                      |
| Webpack                         | Plugin / Native | Via [`pnp-webpack-plugin`](https://github.com/arcanis/pnp-webpack-plugin), will be native starting from 5+                                                                                                                                                                                          |
| Flow                            | Incompatible    | Follow [yarnpkg/berry#634](https://github.com/yarnpkg/berry/issues/634)                                                                                                                                                                                                                             |
| React Native                    | Incompatible    | Follow [react-native-community/cli#27](https://github.com/react-native-community/cli/issues/27)                                                                                                                                                                                                     |
| VSCode Extension Manager (vsce) | Incompatible    | Use the [vsce-yarn-patch](https://www.npmjs.com/package/vsce-yarn-patch) fork with the `node-modules` plugin enabled. The fork is required until [microsoft/vscode-vsce#379](https://github.com/microsoft/vscode-vsce/pull/379) is merged, as `vsce` currently uses the removed `yarn list` command |

This list is kept up-to-date based on the latest release we've published starting from the v2. In case you notice something off in your own project please try to upgrade Yarn and the problematic package first, then feel free to file an issue. And maybe a PR? 😊

---

**Important:** If a tool is incompatible with PnP, you can still enable the [`node-modules` plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-node-modules). Just follow the [instructions](/advanced/migration#if-required-enable-the-node-modules-plugin) and you'll be ready to go in a minute 🙂
