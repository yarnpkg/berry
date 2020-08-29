---
category: advanced
path: /advanced/rulebook
title: "Rulebook"
---

Package authors have some responsibilities when writing packages to make them portable across the ecosystem. This page details the up-to-date collection of good practices you should follow in order to make your package work seamlessly on all three main package managers (Yarn, pnpm, and npm).

```toc
# This code block gets replaced with the Table of Contents
```

## Packages should only ever require what they formally list in their dependencies

<details>
<summary>

<b>Why?</b> Because otherwise your package is susceptible to unpredictable [hoisting](/advanced/lexicon#hoisting) that will lead some of your consumers to experience crashes depending on the other packages they use. Click on this paragraph to expand it and read a detailed example of the issues typically triggered by incorrect hoisting.

</summary>

Imagine that Alice uses Babel. Babel depends on an utility package which itself depends on Lodash. Since the utility package already depends on Lodash, Bob, the Babel maintainer, decided to use Lodash without formally declaring it in Babel itself.

![](/2020-08-28-23-21-52.png)

Because of the hoisting, Lodash will be put at the top, the tree becoming something like this:

![](/2020-08-29-16-38-30.png)

So far, everything is nice: the utility package can still require Lodash, but now Babel can too. Percect! Now, imagine that Alice also adds Gatsby to the mix, which would change the dependency tree as such:

![](/2020-08-29-16-34-13.png)

Now the hoisting becomes more interesting - since Babel doesn't formally declare the dependency, two different hoistings layouts can happen. The first one is pretty much identical to what you already had before, and under this layout things are working just fine:

![](/2020-08-29-16-43-25.png)

But a second layout is just as likely! And that's when things become trickier:

![](/2020-08-29-16-46-00.png)

First, let's check that this layout is valid: Gatsby still gets its Lodash 4 dependency, the Babel utility package still gets Lodash 1, and Babel itself still gets the utility package, just like before. But hold on - something subtly changed! Babel will no longer access Lodash 1! It'll instead retrieve the Lodash 4 copy that Gatsby provided - likely incompatible with whatever Babel originally expected. In the best case the application will crash, in the worst case it'll silently pass and generate buggy results.

If Babel had instead defined Lodash 1 as its own dependency, the package manager would have been able to encode this constraint and ensure that the requirement would have been met regardless of the hoisting.

</details>

**Solution:** In most cases (when the missing dependency is a utility package), the fix is really just to add the missing entry to the [`dependencies` field](/configuration/manifest#dependencies). While often enough, three more complex cases sometimes arise:

- If your package is a plugin (for example `babel-plugin-transform-commonjs`) and the missing dependency is the core (for example `babel-core`), you would need to instead register the dependency inside the [`peerDependencies` field](/configuration/manifest#peerDependencies).

- If your package only require the dependency in specific cases that the user control (for example `mikro-orm` which only depends on `sqlite3` if the consumer actually uses a SQLite3 database), use the [`peerDependenciesMeta` field](/configuration/manifest#peerDependenciesMeta.optional) to declare the peer dependency as optional and silence any warning when unmet.

- If your package is a meta-package of utilities (for example Next.js, which itself depends on Webpack so that its consumer don't have to do it), the situation is a bit complicated and you have two different options:

  - The preferred one is to list the dependency (in Next.js's case, `webpack`) as *both a dependency and a peer dependency*. Yarn will interpret this pattern as "peer dependency with a default", meaning that your users will be able to take ownership of the Webpack package - while still giving the package manager the ability to emit a warning if the provided version is incompatible with the one your package expects.

  - An alternative is to instead re-export the dependency as one of your symbol. For example, Next could expose a `next/webpack` file that would only contain `module.exports = require('webpack')` and that consumers would require instead of the typical `webpack`. This isn't the recommended approach, however, because it wouldn't play well with plugin that expect Webpack to be a peer dependency (since they wouldn't know that they need to use this `next/webpack` module instead).

## Modules shouldn't hardcode `node_modules` paths to access other modules

**Why?** The hoisting makes it impossible to be sure that the layout of the `node_modules` folder will always be the same. Depending on the exact install strategy, `node_modules` folders may not even exist.

**Solution:** If you need to access one of your dependencies' file through the `fs` API (for example to read the its `package.json`), just use `require.resolve` to obtain the path without having to make assumptions about the dependency location:

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

**Solution:** If you're writing a [script](http://localhost:8000/configuration/manifest#scripts), you can just access the binary from its name! So instead of `node_modules/.bin/jest -w`, prefer just writing `jest -w` which will work just as well. If `jest` isn't available, check that the current package properly [defines it as a dependency](#a-package-should-only-require-what-it-lists-in-its-dependencies).

Sometimes you may have slightly more complex needs, for example if you wish to spawn a script with specific Node flags. Depending on the context we recommend passing options via the [`NODE_OPTIONS` environment variable](https://nodejs.org/api/cli.html#cli_node_options_options) rather than the CLI, but if that's not an option you can use `yarn bin <name>` to get the path to the binary script:

```
yarn node --inspect $(yarn bin jest)
```

Note that, in this particular case, `yarn run` also supports the `--inspect` flag so you could just write:

```
yarn run --inspect jest
```

## Published packages should avoid using `npm run` in their scripts

**Why?** This is a tricky one ... basically, it boils down to: package managers are not interchangeable. Using one package manager on a project installed by another is a recipe for disaster, as they follow different configuration and rules. For example, Yarn offers a hook system that allow users to track which scripts are executed and how much time they take. Because `npm run` necessarily wouldn't know how to call these hooks, they would get sidestepped, leading to frustrating experiences.

**Solution:** While as not esthetically pleasing as what you hope for, the best option at the moment is to replace `npm run <name>` (or `yarn run <name>`) in postinstall scripts by the following:

```
$npm_execpath run <name>
```

The `$npm_execpath` environment variable will get replaced by the right binary depending on the package manager your consumers will use. Yarn also supports just calling `run <name>` without any mention of the package manager, but to this date no other package manager does.

## Packages should never write inside their own folder outside of postinstall

**Why?** Depending on the install strategy, packages may be kept in read-only data stores where write access will be rejected. This is particularly true when using "system-global" package stores, where modifying the sources for one package would risk corrupting all the packages on the system.

**Solution:** Just write in another directory rather than your own package. Anything would work, but a very common idiom is to use the `node_modules/.cache` folder in order to store cache data - this is what use Babel, Webpack, and more.

If you absolutely need to write into your package's source folder (but really, we never came across this use case before), you still have the option to use [`preferUnplugged`](/configuration/manifest#preferUnplugged) to instruct Yarn to disable optimizations on your package and store it inside its own project-local copy, where you'll be able to mutate it at will.
