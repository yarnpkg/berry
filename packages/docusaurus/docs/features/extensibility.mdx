---
category: features
slug: /features/extensibility
title: "Extensibility"
description: The strategies Yarn follows so you can always find a way to unblock yourself.
---

## Overview

Many Yarn users have many different use cases, and while we try to find satisfying solutions to most common problems, our team may not have the bandwidth to research and maintain some of the most exotic ones. To avoid blocking you should you face a novel situation that Yarn doesn't support out of the box yet, we provide a very powerful API that you can leverage in your own custom plugins.

Plugins are, in essence, small scripts listed in your configuration that Yarn will dynamically require at startup.

## What can plugins do?

- **Plugins can add new resolvers.** Resolvers are the components tasked from converting dependency ranges (for example `^1.2.0`) into fully-qualified package references (for example `npm:1.2.0`). By implementing a resolver, you can tell Yarn which versions are valid candidates to a specific range.

- **Plugins can add new fetchers.** Fetchers are the components that take the fully-qualified package references we mentioned in the previous step (for example `npm:1.2.0`) and know how to obtain the actual package data they reference. Fetchers can work with remote sources (for example the npm registry), but can also find the packages directly from their location on the disk (or any other data source).

- **Plugins can add new linkers.** Once all the packages have been located and are ready for installation, Yarn will call the linkers to generate the files needed for the install targets to work properly. As an example, the PnP linker generates a Node.js loader file, the node-modules linker generates a `node_modules` folder, and an hypothetical Python linker would generate a virtualenv.

- **Plugins can add new commands.** Each plugin can ship as many commands as they see fit, which will be injected into our CLI (also making them available through `yarn --help`). Because the Yarn plugins are dynamically linked with the running Yarn process, they have access to the full Yarn API, just like any other official command. This lets you experiment with your own custom logic, should Yarn be missing something you need.

- **Plugins can register to some events.** Yarn has a concept known as "hooks", where events are periodically triggered during the lifecycle of the package manager. Plugins can register to those hooks in order to add their own logic depending on what the core allows. For example, the `afterAllInstalled` hook will be called each time an install is performed.


## How to write a plugin?

We have a tutorial for this! Head over to [Plugin Tutorial](/advanced/plugin-tutorial).


:::tip
You'll want to use the Yarn API from your hooks and commands - learning it may look scary, but you have access to the best examples there is: Yarn itself!

For example, the implementation of `yarn workspaces focus` is only about [a hundred lines of code](https://github.com/yarnpkg/berry/blob/master/packages/plugin-workspace-tools/sources/commands/focus.ts), making it a good starting point if you wish to implement partial installs according to your own logic.
:::
