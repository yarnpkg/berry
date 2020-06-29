---
category: features
path: /features/plugins
title: "Plugins"
---

Ever since Yarn was created, our very essence has been about experimenting, evolving, pushing the status quo - rinse and repeat, each time one step further, each time paving the way for our next move.

As you can guess, this philosophy (coupled with the high number of external contributions we receive) requires us to iterate fast in order to accommodate the various experiments that we brew. In a major step forward, Yarn got redesigned in the v2 in order to leverage a new modular API that can be extended through plugins. Nowadays, most of our features are implemented through those plugins - even `yarn add` and `yarn install` are preinstalled plugins!

```toc
# This code block gets replaced with the Table of Contents
```

## Where to find plugins?

Just type [`yarn plugin list`](/cli/plugin/list), or consult the repository: [plugins.yml](https://github.com/yarnpkg/berry/blob/master/plugins.yml).

Note that the plugins exposed through `yarn plugin list` are only the official ones. Since plugins are single-file JS scripts, anyone can author them. By using [`yarn plugin import`](/cli/plugin/import) with an URL or a filesystem path, you'll be able to download (and execute, be careful!) code provided by anyone.

## How to write plugins?

We have a tutorial for this! Head over to [Plugin Tutorial](/advanced/plugin-tutorial).

## What can plugins do?

  - **Plugins can add new resolvers.** Resolvers are the components tasked from converting dependency ranges (for example `^1.2.0`) into fully-qualified package references (for example `npm:1.2.0`). By implementing a resolver, you can tell Yarn which versions are valid candidates to a specific range.

  - **Plugins can add new fetchers.** Fetchers are the components that take the fully-qualified package references we mentioned in the previous step (for example `npm:1.2.0`) and know how to obtain the data of the package they belong to. Fetchers can work with remote packages (for example the npm registry), but can also find the packages directly from their location on the disk (or any other data source).

  - **Plugins can add new linkers.** Once all the packages have been located and are ready for installation, Yarn will call the linkers to generate the files needed for the install targets to work properly. As an example, the PnP linker would generate the `.pnp.js` manifest, and a Python linker would instead generate the virtualenv files needed.

  - **Plugins can add new commands.** Each plugin can ship as many commands as they see fit, which will be injected into our CLI (also making them available through `yarn --help`). Because the Yarn plugins are dynamically linked with the running Yarn process, they can be very small and guaranteed to share the exact same behavior as your package manager (which wouldn't be the case if you were to reimplement the workspace detection, for example).

  - **Plugins can register to some events.** Yarn has a concept known as "hooks", where events are periodically triggered during the lifecycle of the package manager. Plugins can register to those hooks in order to add their own logic depending on what the core allows. For example, the `afterAllInstalled` hook will be called each time the `Project#install` method ends - typically after each `yarn install`.

  - **Plugins can be integrated with each other.** Each plugin has the ability to trigger special actions called hooks, and to register themselves to any defined hook. So for example, you could make a plugin that would execute an action each time a package is added as dependency of one of your workspaces!
