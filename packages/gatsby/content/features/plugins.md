---
category: features
path: /features/plugins
title: "Plugins"
description: An overview of Yarn's plugin capabilities.
---

Ever since Yarn was created, our very essence has been about experimenting, evolving, pushing the status quo - rinse and repeat, each time one step further, each time paving the way for our next move.

As you can guess, this philosophy (coupled with the high number of external contributions we receive) requires us to iterate fast in order to accommodate the various experiments that we brew. In a major step forward, Yarn got redesigned in the v2 in order to leverage a new modular API that can be extended through plugins. Nowadays, most of our features are implemented through those plugins - even `yarn add` and `yarn install` are preinstalled plugins!

```toc
# This code block gets replaced with the Table of Contents
```

## What can plugins do?

  - **Plugins can add new resolvers.** Resolvers are the components tasked from converting dependency ranges (for example `^1.2.0`) into fully-qualified package references (for example `npm:1.2.0`). By implementing a resolver, you can tell Yarn which versions are valid candidates to a specific range.

  - **Plugins can add new fetchers.** Fetchers are the components that take the fully-qualified package references we mentioned in the previous step (for example `npm:1.2.0`) and know how to obtain the data of the package they belong to. Fetchers can work with remote packages (for example the npm registry), but can also find the packages directly from their location on the disk (or any other data source).

  - **Plugins can add new linkers.** Once all the packages have been located and are ready for installation, Yarn will call the linkers to generate the files needed for the install targets to work properly. As an example, the PnP linker would generate the `.pnp.cjs` manifest, and a Python linker would instead generate the virtualenv files needed.

  - **Plugins can add new commands.** Each plugin can ship as many commands as they see fit, which will be injected into our CLI (also making them available through `yarn --help`). Because the Yarn plugins are dynamically linked with the running Yarn process, they can be very small and guaranteed to share the exact same behavior as your package manager (which wouldn't be the case if you were to reimplement the workspace detection, for example).

  - **Plugins can register to some events.** Yarn has a concept known as "hooks", where events are periodically triggered during the lifecycle of the package manager. Plugins can register to those hooks in order to add their own logic depending on what the core allows. For example, the `afterAllInstalled` hook will be called each time the `Project#install` method ends - typically after each `yarn install`.

  - **Plugins can be integrated with each other.** Each plugin has the ability to trigger special actions called hooks, and to register themselves to any defined hook. So for example, you could make a plugin that would execute an action each time a package is added as dependency of one of your workspaces!

## How to write plugins?

We have a tutorial for this! Head over to [Plugin Tutorial](/advanced/plugin-tutorial).

## Official plugins

```
yarn plugin import <name>
```

- [**constraints**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-constraints) - Adds new commands to Yarn to enforce lint rules across workspaces. See the [dedicated page](/features/constraints) for more information.

- [**exec**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-exec) - Adds a new protocol to Yarn (`exec:`) that dynamically generates arbitrary packages rather than downloading them from a known location. See the [plugin page](https://github.com/yarnpkg/berry/tree/master/packages/plugin-exec) for more information.

- [**interactive-tools**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-interactive-tools) - Adds various commands providing a more high-level control on your project using graphical terminal interfaces (for example [`yarn upgrade-interactive`](/cli/upgrade-interactive)).

- [**stage**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-stage) - Adds a new command to Yarn (`yarn stage`) to automatically stage & commit all changes to Yarn-related files in a single line.

- [**typescript**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript) - Improves the TypeScript experience (for example by automatically adding `@types` packages as dependencies when needed). See the [plugin page](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript) for more information.

- [**version**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-version) - Adds a new workflow to Yarn (`yarn version`) to efficiently manage releases in a monorepository. See the [dedicated page](/features/release-workflow) for more information.

- [**workspace-tools**](https://github.com/yarnpkg/berry/tree/master/packages/plugin-workspace-tools) - Adds various commands that make working with workspaces a more pleasing experience (for example [`yarn workspaces foreach`](/cli/workspaces/foreach)).

## Contrib plugins

```
yarn plugin import <bundle url>
```

This is just a centralized list of third-party plugins to make discovery easier. No guarantees are made as to plugin quality, compatibility, or lack of malicious code. As with all third-party dependencies, you should review them yourself before including them in your project.

- [**plugin-installs**](https://gitlab.com/Larry1123/yarn-contrib/-/blob/master/packages/plugin-production-install/README.md) by [**Larry1123**](https://gitlab.com/Larry1123) - create minimal yarn installs after removing development dependencies, unrelated workspaces, `@types` packages, etc

- [**yarn.build**](https://yarn.build/) by [**Owen Kelly**](https://github.com/ojkelly/yarn.build) - monorepo tooling that leverages Yarn's dependency graph to run `build` and `test` on whats changed in parallel as fast as possible. It also includes a command to `bundle` them up into deployable apps for Docker, AWS Lambda, or any other server. Each command is also available as an individual plugin.

- [**package-yaml**](https://github.com/ojkelly/yarn.build#plugin-package-yaml) by [**yarn.build**](https://github.com/ojkelly/yarn.build) - per package opt-in to transparently using `package.yml` instead of `package.json`

- [**licenses**](https://github.com/tophat/yarn-plugin-licenses) by [**Noah Negin-Ulster**](https://noahnu.com/) - audit direct and indirect dependency licenses to ensure compliance

- [**semver-up**](https://github.com/tophat/yarn-plugin-semver-up) by [**Noah Negin-Ulster**](https://noahnu.com/) - configurable `yarn up` command that preserves semantic version ranges and update groups

- [**conditions**](https://github.com/nicolo-ribaudo/yarn-plugin-conditions) by [**Nicolò Ribaudo**](https://twitter.com/NicoloRibaudo) - allow choosing between different dependency versions via install-time (during development) and publish-time flags

- [**az-cli-auth**](https://github.com/FishandRichardsonPC/yarn-plugin-az-cli-auth) by [**Fish & Richardson P.C**](https://fr.com) - Uses the az cli to generate auth tokens when using azure devops repos

- [**gcp-auth**](https://github.com/AndyClausen/yarn-plugin-gcp-auth) by [**Andreas Clausen**](https://github.com/AndyClausen) - Uses gcloud to generate access tokens when using Google Artifact Registry repos

- [**outdated**](https://github.com/mskelton/yarn-plugin-outdated) by [**Mark Skelton**](https://github.com/mskelton) - lists outdated dependencies similar to the Yarn 1.x `outdated` command

- [**engines**](https://github.com/devoto13/yarn-plugin-engines) by [**Yaroslav Admin**](https://github.com/devoto13) - enforces a Node version range specified in the `package.json`'s `engines.node` field

- [**licenses**](https://github.com/mhassan1/yarn-plugin-licenses) by [**Marc Hassan**](https://github.com/mhassan1) - adds `yarn licenses` commands that are similar to the ones in Yarn v1

- [**aws-codeartifact**](https://github.com/mhassan1/yarn-plugin-aws-codeartifact) by [**Marc Hassan**](https://github.com/mhassan1) - resolves authentication for AWS CodeArtifact NPM registries

- [**after-install**](https://github.com/mhassan1/yarn-plugin-after-install) by [**Marc Hassan**](https://github.com/mhassan1) - adds support for an `afterInstall` hook that runs after every `yarn install`

- [**yaml-manifest**](https://github.com/lyleunderwood/yarn-plugin-yaml-manifest) by [**Lyle Underwood**](https://github.com/lyleunderwood) - use a `package.yml` with comments and whitespace that is automatically synchronized with `package.json`

- [**yarn-plugin-envinfo**](https://github.com/TheKnarf/yarn-plugin-envinfo) by [**TheKnarf**](https://github.com/TheKnarf) - yarn plugin so that you can run envinfo in your project. It'll read a project local configuration file so that different projects can ask for different info. Useful for helping new developers when onboarding them into your project.

If you wrote a plugin yourself, feel free to [open a PR](https://github.com/yarnpkg/berry/edit/master/packages/gatsby/content/features/plugins.md) to add it at the end of this list!
