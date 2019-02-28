---
id: plugin-system
title: Plugin System
sidebar_label: Plugin System
---

Yarn now supports plugins! They're currently a bit experimental and some parts of the API might change, but they're already working and we can't wait to see everything you can do with them.

## First plugin

In order to build a plugin, you'll need the Berry repository. We plan to improve that later on, but for now just fork the repository (yarnpkg/berry) and clone it somewhere.

Once done, create a new folder in the `packages` directory, and initialize it as such:

```
$ mkdir packages/plugin-hello
$ cd packages/plugin-hello
$ yarn init
$ yarn add @berry/core
$ yarn add -D @berry/builder
```

Then create an index file in `sources/index.ts`:

```
import {Plugin}   from '@berry/core';
import {Writable} from 'stream';

const plugin: Plugin = {
  commands: [
    (concierge: any) => concierge
      .command(`hello`)
      .action(async ({stdout}: {stdout: Writable}) => {
        stdout.write(`Hello world!\n`);
      }),
  ],
};

export default plugin;
```

Then build your plugin by running `yarn @berry-build-plugin`, which will generate a file in `bin/@berry/plugin-hello.js`. Now the only remaining thing you have to do is activate the plugin! In order to do this, just open the `.yarnrc` located at the root of the repository and extend the `plugins` key in order to register your newly built plugin:

```
plugins:
  - "./packages/plugin-hello/bin/@berry/plugin-hello.js"
```

And that's it! You can now run `yarn hello`, and Yarn will great you.

## What can plugins do?

There are five different things that plugins can do. For more information feel free to read [Plugin.ts](), which contains the interface of the Plugin class. More documentation is to come.

### Add new resolvers

Plugins can tell Yarn how to choose one version of a package amongst multiple. For example, the [plugin-npm]() tells Yarn how to query the package metadata from the npm registry in order to convert semver descriptor (`^1.0.0`) into versioned locators (`1.2.3`).

### Add new fetchers

Once you know where are located your packages, you also must fetch them from their remote locations. That's what fetchers are for: they take a versioned locator (`1.2.3`) and fetch the package data from wherever they are - in the case of [plugin-npm]() it would be from the npm registry, using the tarball endpoint.

### Add new commands

**Note: This is a very advanced use case**

Linkers are how packages are installed on the disk. The linker shipped with [plugin-pnp]() for example generates a single `.pnp.js` file, but a different linker could generate a `node_modules` or even a Python VirtualEnv setup!

### Add new commands

As you saw in the previous example, plugins can add new commands to the CLI. Those commands have full access to the `@berry/core` module used by your Yarn binary, which allows you to easily implement all sorts of operations on the current project without having to manually read the json files and hope you won't hit some corner case.

Yarn commands are powerful! In fact, all of the commands shipped in Yarn are implemented via plugins (check out [plugin-essentials]() to see by yourself, or [plugin-init]() for an example of a very small plugin with a more practical purpose than our plugin-hello).

### Add new configuration settings

Plugins can declare their own configuration settings, which your users can then set through their `.yarnrc` files. It's a handy way to make your plugins configurable without having to reinvent the whell. Plus, they're directly integrated within `yarn config`!
