---
category: features
path: /features/plugins
title: "Plugins"
---

Ever since Yarn was created, our very essence has been about experimenting, evolving, pushing the status quo - rinse and repeat, each time one step further, each time paving the way for our next move.

As you can guess, this philosophy (coupled with the high number of external contribution we receive) requires us to iterate fast in order to accomodate with the various experiments that we brew. In a major step forward, Yarn got redesigned in the v2 in order to leverage a new modular API that can be extended through plugins. Nowadays, most of our features are implemented through those plugins - even `yarn add` and `yarn install` are preinstalled plugins!

## What can plugins do?

  - **Plugins can add new resolvers.** Resolvers are the components tasked from converting dependency ranges (for example `^1.2.0`) into fully-qualified package references (for example `npm:1.2.0`). By implementing a resolver, you can tell Yarn which versions are valid candidates to a specific range.

  - **Plugins can add new fetchers.** Fetchers are the components that take the fully-qualified package references we mentioned in the previous step (for example `npm:1.2.0`) and know how to obtain the data of the package they belong to. Fetchers can work with remote packages (for example the npm registry), but can also find the packages directly from their location on the disk (or any other data source).

  - **Plugins can add new linkers.** Once all the packages have been located and are ready for installation, Yarn will call the linkers to generate the files needed for the install targets to work properly. As an example, the PnP linker would generate the `.pnp.js` manifest, and a Python linker would instead generate the virtualenv files needed.

  - **Plugins can add new commands.** Each plugin can ship as many commands as they see fit, which will be injected into our CLI (also making them available through `yarn --help`). Because the Yarn plugins are dynamically linked with the running Yarn process, they can be very small and guaranteed to share the exact same behavior as your package manager (which wouldn't be the case if you were to reimplement the workspace detection, for example).

## How to use plugins?

Plugins are single-file JS scripts built via the `@berry/builder` tools. They are easy to use:

### Automatic setup

The official plugins (the ones whose development happen on the Yarn repository) can be installed using the following commands:

  - `yarn plugin list` will print the name of the available official plugins. Some of them might be marked experimental, in which case they might be subject to breaking changes between releases (they should be mostly stable in general, though).

  - `yarn plugin import <plugin-name>` will download one of the plugins from the list, store it within the `.yarn/plugins` directory, and modify your local `.yarnrc.yml` file to reference it.

  - `yarn plugin import <url>` will do the same thing, but because it uses a URL it will work with any plugin regardless of where the plugin is actually hosted.

### Manual setup

The `yarn plugin import` command is useful, but in case you prefer to setup your project yourself:

  - Download the plugin you want to use and put it somewhere

  - Update your project-level `.yarnrc.yml` file by adding the following property:

    ```
    plugins:
      - "./my-plugin.js"
    ```
