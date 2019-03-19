---
category: features
path: /features/plugins
title: "Plugins"
---

Ever since Yarn was created, our very essence has been experimenting. We wanted this project to break the status quo, then evolve and repeat the process - each time one step further, each time paving the way for the next step.

In order to accomodate with this philosophy, the v2 received fundamental changes that turned Yarn into an actual Javascript API as much as a CLI. Additionally, the CLI got reworked so that user scripts can be interconnected with Yarn's core components and extend the tool with new features. We call them plugins and, in fact, you already use them - most commands such as `yarn add` are implemented through plugins!

## What can plugins do?

  - **Plugins can add new resolvers.** Resolvers are the components tasked from converting dependency ranges (for example `^1.2.0`) into fully-qualified package references (for example `npm:1.2.0`). By implementing a resolver, you can tell Yarn which versions are valid candidate to a specific range.

  - **Plugins can add new fetchers.** Fetchers are the components that take the fully-qualified package references we mentioned in the previous step and find their location on the disk. Fetchers can work with remote packages (for example by downloading the files from a registry), but can also find the packages directly on the disk (like we do for the `file:` and `portal:` protocols).

  - **Plugins can add new linkers.** Once all the packages have been located and are ready for installation, Yarn will call the linkers to generate the files needed for the install targets to work properly. The PnP linker will generate its `.pnp.js` files, while a Python linker would generate the virtualenv files needed.

  - **Plugins can add new commands.** Each plugin can ship as many commands as they see fit, which will be injected into our CLI (including via `yarn --help`). The main benefit you have with exposing tools this way rather than using them through `yarn run <tool-name>` is that your plugin gets dynamically linked within the Yarn context, meaning that you're sure to use the exact same component versions as the one used by your user.

And of course, plugins can add new configuration settings as they see fit - Yarn will throw an exception if it finds a configuration settings that isn't supported by any plugin, which prevents users from accidentally depending on a plugin that doesn't exist.

## How to use plugins?

Plugins are single-file JS scripts built via the `@berry/builder` tools. They are relatively easy to use (we plan to improve it even more by wrapping the process within a CLI command):

  - Download the plugin you want to use and put it somewhere within your project
  - Update your project-level `.yarnrc` file by adding the following property:

    ```
    plugins:
      - "./my-plugin.js"
    ```

And that's it! The next time you'll start Yarn, your plugin will be injected into the environment.
