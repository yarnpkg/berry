---
category: advanced
slug: /advanced/rulebook
title: "Rulebook"
description: An in-depth rulebook of best-practices and recommendations regarding dependencies.
---

Writing portable packages is incredibly important, as it ensures that your users will benefit from an optimal experience regardless of their package manager.

To help with that, this page details the up-to-date collection of good practices you should follow in order to make your package work seamlessly on all three main package managers (Yarn, pnpm, and npm), and explanations if you want to learn more.

## Packages should only ever require what they formally list in their dependencies

**Why?** Because otherwise your package will be susceptible to unpredictable [hoisting](/advanced/lexicon#hoisting) that will lead some of your consumers to experience pseudo-random crashes, depending on the other packages they will happen to use.

Imagine that Alice uses Babel. Babel depends on an utility package which itself depends on an old version of Lodash. Since the utility package already depends on Lodash, Bob, the Babel maintainer, decided to use Lodash without formally declaring it in Babel itself.

![](/2020-08-28-23-21-52.png)

Because of the hoisting, Lodash will be put at the top, the tree becoming something like this:

![](/2020-08-29-16-38-30.png)

So far, everything is nice: the utility package can still require Lodash, but we no longer need to create sub-directories within Babel. Now, imagine that Alice also adds Gatsby to the mix, which we'll pretend also depends on Lodash, but this time on a modern release; the tree will look like this:

![](/2020-08-29-16-34-13.png)

The hoisting becomes more interesting - since Babel doesn't formally declare the dependency, two different hoisting layouts can happen. The first one is pretty much identical to what we already had before, with the exception that we now have two copies of Lodash, with only a single one hoisted to the stop so we don't cause a conflict:

![](/2020-08-29-16-43-25.png)

But a second layout is just as likely! And that's when things become trickier:

![](/2020-08-29-16-46-00.png)

First, let's check that this layout is valid: Gatsby still gets its Lodash 4 dependency, the Babel utility package still gets Lodash 1, and Babel itself still gets the utility package, just like before. But something else changed! Babel will no longer access Lodash 1! It'll instead retrieve the Lodash 4 copy that Gatsby provided, likely incompatible with whatever Babel originally expected. In the best case the application will crash, in the worst case it'll silently pass and generate incorrect results.

If Babel had instead defined Lodash 1 as its own dependency, the package manager would have been able to encode this constraint and ensure that the requirement would have been met regardless of the hoisting.

**Solution:** In most cases (when the missing dependency is a utility package), the fix is really just to add the missing entry to the [`dependencies` field](/configuration/manifest#dependencies). While often enough, a few more complex cases sometimes arise:

- If your package is a plugin (for example `babel-plugin-transform-commonjs`) and the missing dependency is the core (for example `babel-core`), you would need to instead register the dependency inside the [`peerDependencies` field](/configuration/manifest#peerDependencies).

- If your package is something that automatically loads plugins (for example `eslint`), peer dependencies obviously aren't an option as you can't reasonably list all plugins. Instead, you should use the [`createRequire` function](https://nodejs.org/api/module.html#module_module_createrequire_filename) (or its [polyfill](https://github.com/nuxt-contrib/create-require)) to load plugins *on behalf of* the configuration file that lists the plugins to load - be it the package.json or a custom one like the `.eslintrc.js` file.

- If your package only requires the dependency in specific cases that the user control (for example `mikro-orm` which only depends on `sqlite3` if the consumer actually uses a SQLite3 database), use the [`peerDependenciesMeta` field](/configuration/manifest#peerDependenciesMeta.optional) to declare the peer dependency as optional and silence any warning when unmet.

- If your package is a meta-package of utilities (for example Next.js, which itself depends on Webpack so that its consumers don't have to do it), the situation is a bit complicated and you have two different options:

  - The preferred one is to list the dependency (in Next.js's case, `webpack`) as *both a regular dependency and a peer dependency*. Yarn will interpret this pattern as "peer dependency with a default", meaning that your users will be able to take ownership of the Webpack package if they need to, while still giving the package manager the ability to emit a warning if the provided version is incompatible with the one your package expects.

  - An alternative is to instead re-export the dependency as part of your public API. For example, Next could expose a `next/webpack` file that would only contain `module.exports = require('webpack')`, and consumers would require that instead of the typical `webpack` module. This isn't the recommended approach, however, because it wouldn't play well with plugins that expect Webpack to be a peer dependency (they wouldn't know that they need to use this `next/webpack` module instead).

## Modules shouldn't hardcode `node_modules` paths to access other modules

**Why?** The hoisting makes it impossible to be sure that the layout of the `node_modules` folder will always be the same. In fact, depending on the exact install strategy, the `node_modules` folders may not even exist.

**Solution:** If you need to access one of your dependencies' files through the `fs` API (for example to read a dependency's `package.json`), just use `require.resolve` to obtain the path without having to make assumptions about the dependency location:

```ts
const fs = require(`fs`);
const data = fs.readFileSync(require.resolve(`my-dep/package.json`));
```

If you need to access one of your dependencies' dependency (we really don't recommend that, but in some fringe cases it may happen), instead of hardcoding the `node_modules` path, use the [`createRequire`](https://nodejs.org/api/module.html#module_module_createrequire_filename) function:

```ts
const {createRequire} = require(`module`);
const firstDepReq = createRequire(require.resolve(`my-dep/package.json`));
const secondDep = firstDepReq(`transitive-dep`);
```

Note that while `createRequire` is Node 12+, a polyfill exists under the name [`create-require`](https://github.com/nuxt-contrib/create-require).

## User scripts shouldn't hardcode the `node_modules/.bin` folder

**Why?** The `.bin` folder is an implementation detail, and may not exist at all depending on the install strategy.

**Solution:** If you're writing a [script](/configuration/manifest#scripts), you can just refer to the binary by its name! So instead of `node_modules/.bin/jest -w`, prefer just writing `jest -w` which will work just fine. If for some reason `jest` isn't available, check that the current package properly [defines it as a dependency](#a-package-should-only-require-what-it-lists-in-its-dependencies).

Sometimes you may find yourself having slightly more complex needs, for example if you wish to spawn a script with specific Node flags. Depending on the context we recommend passing options via the [`NODE_OPTIONS` environment variable](https://nodejs.org/api/cli.html#cli_node_options_options) rather than the CLI, but if that's not an option you can use `yarn bin name` to get the specified binary path:

```
yarn node --inspect $(yarn bin jest)
```

Note that, in this particular case, `yarn run` also supports the `--inspect` flag so you could just write:

```
yarn run --inspect jest
```

## Published packages should avoid using `npm run` in their scripts

**Why?** This is a tricky one ... basically, it boils down to: package managers are not interchangeable. Using one package manager on a project installed by another is a recipe for troubles, as they follow different configuration settings and rules. For example, Yarn offers a hook system that allows its users to track which scripts are executed and how much time they take. Because `npm run` wouldn't know how to call these hooks, they would get ignore, leading to frustrating experiences for your consumers.

**Solution:** While not the most esthetically pleasing option, the most portable one at the moment is to simply replace `npm run name` (or `yarn run name`) in your postinstall scripts and derived by the following:

```
$npm_execpath run <name>
```

The `$npm_execpath` environment variable will get replaced by the right binary depending on the package manager your consumers will use. Yarn also supports just calling `run <name>` without any mention of the package manager, but to this date no other package manager does.

## Packages should never write inside their own folder outside of postinstall

**Why?** Depending on the install strategy, packages may be kept in read-only data stores where write accesses will be rejected. This is particularly true when using "system-global" stores, where modifying the sources for one package would risk corrupting all the projects depending on it from the same machine.

**Solution:** Just write in another directory rather than your own package. Anything would work, but a very common idiom is to use the `node_modules/.cache` folder in order to store cache data - that's for example what Babel, Webpack, and more do.

If you absolutely need to write into your package's source folder (but really, we never came across this use case before), you still have the option to use [`preferUnplugged`](/configuration/manifest#preferUnplugged) to instruct Yarn to disable optimizations on your package and store it inside its own project-local copy, where you'll be able to mutate it at will.

## Packages should use the `prepack` script to generate dist files before publishing

**Why?** The original npm supported [many different scripts](https://docs.npmjs.com/misc/scripts). So much, in fact, that it became very difficult to know which script one would want to use in which context. In particular, the very subtle differences between the `prepack`, `prepare`, `prepublish`, and `prepublish-only` scripts led many to use the wrong script in the wrong context. For this reason, Yarn 2 deprecated most of the scripts and consolidated them around a restricted set of portable scripts.

**Solution:** Always use the `prepack` script if you wish to generate dist artifacts before publishing your package. It will get called before calling `yarn pack` (which itself is called before calling `yarn npm publish`), when cloning your git repository as a git dependency, and any time you will run `yarn prepack`. As for `prepublish`, never use it with side effects - its only use should be to run tests before the publish step.
