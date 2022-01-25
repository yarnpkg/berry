---
category: features
path: /features/pnp
title: "Plug'n'Play"
description: An overview of Plug'n'Play, a powerful and innovative installation strategy for Node.
---

> **PnP API**
>
> Are you a library author trying to make your library compatible with the Plug'n'Play installation strategy? Do you want to use the PnP API for something awesome? If the answer to any of these questions is yes, make sure to visit the [PnP API](/advanced/pnpapi) page after reading the introduction!

Unveiled in September 2018, Plug'n'Play is an innovative installation strategy for [Node](https://nodejs.org/). Based on prior work in other languages (for example [autoload](https://getcomposer.org/doc/04-schema.md#autoload) for PHP), it presents interesting characteristics that build upon the regular [CommonJS](https://en.wikipedia.org/wiki/CommonJS) `require` workflow in an almost completely backward-compatible way.

```toc
# This code block gets replaced with the Table of Contents
```

## The node_modules problem

The way installs used to work was simple: when running `yarn install` Yarn would generate a `node_modules` directory that Node was then able to consume thanks to its built-in [Node Resolution Algorithm](https://nodejs.org/api/modules.html#modules_all_together). In this context, Node didn't have to know the first thing about what a "package" was: it only reasoned in terms of files. "Does this file exist here? No: Ok, let's look in the parent `node_modules` then. Does it exist here? Still no: Ok ...", and it kept going until it found the right one. This process was vastly inefficient for several reasons:

- The `node_modules` directories typically contained gargantuan amounts of files. Generating them could make up for more than 70% of the time needed to run `yarn install`. Even having preexisting installations wouldn't save you, as package managers still had to diff the contents of `node_modules` with what it _should_ contain.

- Because the `node_modules` generation was an I/O-heavy operation, package managers didn't have much leeway to optimize it beyond just doing a simple file copy - and even though it could have used hardlinks or copy-on-write when possible, it would still have needed to diff the current state of the filesystem before making a bunch of syscalls to manipulate the disk.

- Because Node had no concept of packages, it also didn't know whether a file was _meant_ to be accessed. It was entirely possible that the code you wrote worked one day in development but broke later in production because you forgot to list one of your dependencies in your `package.json`.

- Even at runtime, the Node resolution had to make a bunch of `stat` and `readdir` calls to figure out where to load every single required file from. It was extremely wasteful and was part of why booting Node applications took so much time.

- Finally, the very design of the `node_modules` folder was impractical in that it didn't allow package managers to properly de-duplicate packages. Even though some algorithms could be employed to optimize the tree layout ([hoisting](https://yarnpkg.com/advanced/lexicon#hoisting)), we still ended up unable to optimize some particular patterns - causing not only the disk usage to be higher than needed, but also some packages to be instantiated multiple times in memory.

## Fixing node_modules

Yarn already knows everything there is to know about your dependency tree - it even installs it on the disk for you. So, why is it up to Node to find where your packages are? Instead, it should be the package manager's job to inform the interpreter about the location of the packages on the disk and manage any dependencies between packages and even versions of packages. This is why Plug'n'Play was created.

In this install mode (the default starting from Yarn 2.0), Yarn generates a single `.pnp.cjs` file instead of the usual `node_modules` folder containing copies of various packages. The `.pnp.cjs` file contains various maps: one linking package names and versions to their location on the disk and another one linking package names and versions to their list of dependencies. With these lookup tables, Yarn can instantly tell Node where to find any package it needs to access, as long as they are part of the dependency tree, and as long as this file is loaded within your environment (more on that in the next section).

This approach has various benefits:

- Installs are now nearly instantaneous. Yarn only needs to generate a single text file (instead of potentially tens of thousands). The main bottleneck becomes the number of dependencies in a project rather than disk performance.

- Installs are more stable and reliable due to reduced I/O operations. Especially on Windows (where writing and removing files in batches may trigger various unintended interactions with Windows Defender and similar tools), I/O heavy `node_modules` operations were more prone to failure.

- Perfect optimization of the dependency tree (aka perfect hoisting) and predictable package instantiations.

- The generated `.pnp.cjs` file can be committed to your repository as part of the [Zero-Installs](/features/zero-installs) effort, removing the need to run `yarn install` in the first place.

- Faster application startup! The Node resolution doesn't have to iterate over the filesystem hierarchy nearly as much as before (and soon won't have to do it at all!).

## Initializing PnP

Yarn generates a single `.pnp.cjs` file that needs to be installed for Node to know where to find the relevant packages. This registration is generally transparent: any direct or indirect `node` command executed through one of your `scripts` entries will automatically register the `.pnp.cjs` file as a runtime dependency. For the vast majority of use cases, the following will work just as you would expect:

```json
{
  "scripts": {
    "start": "node ./server.js",
    "test": "jest"
  }
}
```

For some remaining edge cases, a small setup may be required:

- If you need to run an arbitrary Node script, use [`yarn node`](/cli/node) as the interpreter, instead of `node`. This will be enough to register the `.pnp.cjs` file as a runtime dependency. 

```
yarn node ./server.js
```

- If you operate on a system that automatically executes a Node script (for instance on Google Cloud Platform (--reference needed here--)), simply require the PnP file at the top of your init script and call its `setup` function.

```
require('./.pnp.cjs').setup();
```

As a quick tip, all `yarn node` typically does is set the `NODE_OPTIONS` environment variable to use the [`--require`](https://nodejs.org/api/cli.html#cli_r_require_module) option from Node, associated with the path of the `.pnp.cjs` file. You can easily apply this operation yourself if you prefer:

```
node -r ./.pnp.cjs ./server.js
NODE_OPTIONS="--require $(pwd)/.pnp.cjs" node ./server.js
```

## PnP `loose` mode

Because the hoisting heuristics aren't standardized and predictable, PnP operating under strict mode will prevent packages from requiring dependencies that are not explicitly listed; even if other dependencies also depend on it. This may cause issues with some packages.

To address this problem, Yarn ships with a "loose" mode which will cause the PnP linker to work in tandem with the `node-modules` hoister - we will first generate the list of packages that would have been hoisted to the top level in a typical `node_modules` install, then remember this list as what we call the "fallback pool".

> Note that because the loose mode directly calls the `node-modules` hoister, it follows the exact same implementation as the true algorithm used by the [`node-modules` linker](https://github.com/yarnpkg/berry/tree/master/packages/plugin-nm)!

At runtime, packages that require unlisted dependencies will still be allowed to access them if any version of the dependency ended up in the fallback pool (which packages exactly are allowed to rely on the fallback pool can be tweaked with [pnpFallbackMode](/configuration/yarnrc#pnpFallbackMode)).

Note that the content of the fallback pool is undetermined. If a dependency tree contains multiple versions of the same package, there is no means to determine which one will be hoisted to the top-level. Therefore, a package accessing the fallback pool will still generate a warning (via the [process.emitWarning](https://nodejs.org/api/process.html#process_process_emitwarning_warning_type_code_ctor) API).

This mode provides a compromise between the `strict` PnP linker and the `node_modules` linker.

In order to enable `loose` mode, make sure that the [`nodeLinker`](/configuration/yarnrc#nodeLinker) option is set to `pnp` (the default) and add the following into your local [`.yarnrc.yml`](/configuration/yarnrc) file:
```yaml
pnpMode: loose
```

[More information about the `pnpMode` option.](/configuration/yarnrc#pnpMode)

### Caveat

Because we *emit* warnings (instead of *throwing* errors) on resolution errors, applications can't *catch* them. This means that the common pattern of trying to `require` an optional peer dependency inside a try/catch block will print a warning at runtime if the dependency is missing, even though it shouldn't. The only runtime implication is that such a warning can cause confusion, but it can safely be ignored.

For this reason, PnP `loose` mode **won't be** the default starting with version 2.1 (as we originally planned). It will continue to be supported as an alternative, hopefully easing the transition to the default and recommended workflow: PnP `strict` mode.

## Alternatives

In the years leading up to Plug'n'Play being ratified as the main install strategy, other projects came up with alternative implementations of the Node Resolution Algorithm - usually to circumvent shortcomings of the `require.resolve` API. Examples include Webpack (`enhanced-resolve`), Babel (`resolve`), Jest (`jest-resolve`), and Metro (`metro-resolver`). These alternatives should be considered as superseded by proper integration with Plug'n'Play.

### Compatibility Table

The following compatibility table gives you an idea of the integration status with various tools from the community. Note that only CLI tools are listed there, as frontend libraries (such as `react`, `vue`, `lodash`, ...) don't reimplement the Node resolution and as such don't need any special logic to take advantage of Plug'n'Play:

**[Suggest an addition to this table](https://github.com/yarnpkg/berry/edit/master/packages/gatsby/content/features/plugnplay.md)**

#### Native support

Many common frontend tools now support Plug'n'Play natively!

| <div style="width:150px">Project name</div> | Note |
| --- | --- |
| Angular | Starting from 13+ |
| Babel | Starting from `resolve` 1.9 |
| Create-React-App | Starting from 2.0+ |
| Docusaurus | Starting from 2.0.0-beta.14 |
| ESLint | Some compatibility issues w/ shared configs (fixable using [@rushstack/eslint-patch](https://yarnpkg.com/package/@rushstack/eslint-patch)) |
| Gatsby | Supported with version ≥2.15.0, ≥3.7.0 |
| Gulp | Supported with version 4.0+ | 
| Husky | Starting from 4.0.0-1+ |
| Jest | Starting from 24.1+ |
| Next.js | Starting from 9.1.2+ |
| Parcel | Starting from 2.0.0-nightly.212+ |
| Preact CLI | Starting from 3.1.0+ |
| Prettier | Starting from 1.17+ |
| Rollup | Starting from `resolve` 1.9+ |
| Storybook | Starting from 6.0+ |
| TypeScript | Via [`plugin-compat`](https://github.com/yarnpkg/berry/tree/master/packages/plugin-compat) (enabled by default)
| TypeScript-ESLint | Starting from 2.12+ |
| VSCode-Stylelint | Starting from 1.1+ |
| WebStorm | Starting from 2019.3+; See [Editor SDKs](https://yarnpkg.com/getting-started/editor-sdks) |
| Webpack | Starting from 5+ ([plugin](https://github.com/arcanis/pnp-webpack-plugin) available for 4.x) |

#### Support via plugins

| <div style="width:150px">Project name</div> | Note |
| --- | --- |
| ESBuild | Via [`@yarnpkg/esbuild-plugin-pnp`](https://github.com/yarnpkg/berry/tree/master/packages/esbuild-plugin-pnp#yarnpkgesbuild-plugin-pnp) |
| VSCode-ESLint | Follow [Editor SDKs](https://yarnpkg.com/getting-started/editor-sdks) |
| VSCode | Follow [Editor SDKs](https://yarnpkg.com/getting-started/editor-sdks) |
| Webpack 4.x | Via [`pnp-webpack-plugin`](https://github.com/arcanis/pnp-webpack-plugin) (native starting from 5+) |

#### Incompatible

The following tools cannot be used with pure Plug'n'Play install (even under loose mode).

**Important:** Even if a tool is incompatible with Plug'n'Play, you can still enable the [`node-modules` plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-nm). Just follow the [instructions](/getting-started/migration#if-required-enable-the-node-modules-plugin) and you'll be ready to go in a minute 🙂

| <div style="width:150px">Project name</div> | Note |
| --- | --- |
| Flow | Follow [yarnpkg/berry#634](https://github.com/yarnpkg/berry/issues/634) |
| React Native | Follow [react-native-community/cli#27](https://github.com/react-native-community/cli/issues/27) |
| Pulumi | Follow [pulumi/pulumi#3586](https://github.com/pulumi/pulumi/issues/3586) |
| VSCode Extension Manager (vsce) | Use the [vsce-yarn-patch](https://www.npmjs.com/package/vsce-yarn-patch) fork with the `node-modules` plugin enabled. The fork is required until [microsoft/vscode-vsce#493](https://github.com/microsoft/vscode-vsce/pull/493) is merged, as `vsce` currently uses the removed `yarn list` command |
| Hugo | Hugo pipes expect a `node-modules` dir. Enable the `node-modules` plugin |
| ReScript | Follow [rescript-lang/rescript-compiler#3276](https://github.com/rescript-lang/rescript-compiler/issues/3276) |

This list is kept up-to-date based on the latest release we've published starting from v2. In case you notice something off in your own project please try to upgrade Yarn and the problematic package first, then feel free to file an issue. And maybe a PR? 😊

## Frequently Asked Questions

### Why not use import maps?

Yarn Plug'n'Play provides semantic errors (explaining you the exact reason why a package isn't reachable from another) and a [sensible JS API](/advanced/pnpapi) to solve various shortcomings with `require.resolve`. These are features that import maps wouldn't solve by themselves.
This is answered in more detail in [this thread](https://github.com/nodejs/modules/issues/477#issuecomment-578091424). 

A main reason we're in this mess today is that the original `node_modules` design tried to abstract packages away in order to provide a generic system that would work without any notion of packages. This became a challenge that prompted many implementers to come up with their own interpretations. Import maps suffer from the same flaw.

### Packages are stored inside Zip archives: How can I access their files?

When using PnP, packages are stored and accessed directly inside the Zip archives from the cache.
The PnP runtime (`.pnp.cjs`) automatically patches Node's `fs` module to add support for accessing files inside Zip archives. This way, you don't have to do anything special:

```js
const {readFileSync} = require(`fs`);

// Looks similar to `/path/to/.yarn/cache/lodash-npm-4.17.11-1c592398b2-8b49646c65.zip/node_modules/lodash/ceil.js`
const lodashCeilPath = require.resolve(`lodash/ceil`);

console.log(readFileSync(lodashCeilPath));
```

### Fallback Mode

Back when PnP was first implemented, the compatibility wasn't as good as it is now. To help with the transition, we designed a fallback mechanism: if a package tries to access an unlisted dependency, it's still allowed to resolve it *if the top-level package lists it as a dependency*. We allow this because there's no resolution ambiguity, as there's a single top-level package in any project. Unfortunately, this may cause confusing behaviors depending on how your project is set up. When that happens, PnP is always right, and the only reason it works when not in a workspace is due to some extra lax.

This behavior was just a patch, and will eventually be removed to clear up any confusion. You can prepare for that now by setting [`pnpFallbackMode`](https://yarnpkg.com/configuration/yarnrc#pnpFallbackMode) to `none`, which will disable the fallback mechanism altogether.
