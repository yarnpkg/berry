---
category: getting-started
slug: /getting-started/migration
title: "Migration"
description: A step-by-step and in-depth migration guide from Yarn 1 (Classic) to Yarn 2 (Berry).
---

Any major release has its breaking changes, and migrating from Classic to Modern isn't an exception. A few old behaviors were cleaned, others got fixed or modified, and some even got removed.

While one of our goals is to make the transition as easy as we can, there are a few things to be aware of when migrating your codebase. To make this process more efficient we've listed below the [recommended migration steps](/getting-started/migration#step-by-step), along with solutions for the most common problems you might face.

## Why should you migrate?

We answer this question in details [here](https://yarnpkg.com/getting-started/qa#why-should-you-upgrade-to-yarn-modern).

In a few words, upgrading to the latest versions is critical to a fast and stable Yarn experience. Numerous bugs were fixed since the first major version, and we no longer expect to build new features on the old trunk. **Even if you don't plan to use the new default installation strategy called Plug'n'Play**, your projects will still get benefits from the upgrade:

- The good old `node_modules` installer improved as well as various edge cases got fixed
- A renewed focus on performances (we now formally track perfs via a [dashboard](https://yarnpkg.com/benchmarks))
- Improved user experience ([`yarn add -i`](/cli/add), [`yarn up`](/cli/up), [`logFilters`](/configuration/yarnrc#logFilters), ...)
- New workflows and capabilities ([`@types` auto-management](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript#yarnpkgplugin-typescript), [release workflow](/features/release-workflow), ...)

And of course a very active development cycle.

## Step by step

:::info
Don't worry if your project isn't quite ready for [Plug'n'Play](/features/pnp) just yet! This guide will let you migrate **without losing your `node_modules` folder**. Only in a later optional section we will cover how to enable PnP support, and this part will only be recommended, not mandatory. Baby steps! 😉
:::

Note that those commands only need to be run once for the whole project and will automatically take effect for all your contributors as soon as they pull the migration commit, thanks to the power of [`yarnPath`](/configuration/yarnrc#yarnPath):

1. Make sure you're using Node 16 or higher
2. Run `corepack enable` to activate [Corepack](https://nodejs.org/api/corepack.html)
2. Go into your project directory
3. Run `yarn set version berry` to enable (cf [Install](/getting-started/install) for more details)
4. If you used `.npmrc` or `.yarnrc`, you'll need to turn them into the [new format](/configuration/yarnrc) (see also [1](/getting-started/migration#update-your-configuration-to-the-new-settings), [2](https://yarnpkg.com/getting-started/migration#dont-use-npmrc-files))
5. Run `yarn install` to migrate the lockfile
6. Commit all changes

Good, you should now have a working Yarn install! Some things might still require some adjustments in your CI scripts (for example the deprecation of [arbitrary `pre/post`-scripts](/advanced/lifecycle-scripts), or the renaming of `--frozen-lockfile` into `--immutable`),  but those special cases will be documented on a case-by-case basis in the rest of this document (for example [here](/getting-started/migration#explicitly-call-the-pre-and-post-scripts) for `pre/post`-scripts).

## Enabling Plug'n'Play

This step is completely optional - while we recommend to use Plug'n'Play for most new projects, it may sometimes require an average time investment to enable it on existing projects. For this reason, we prefer to list it here as a separate step that you can look into if you're curious or simply want the absolute best of what Yarn has to offer.

### Before we start

Plug'n'Play enforces strict dependency rules. In particular, you'll hit problems if you (or your dependencies) rely on unlisted dependencies (the reasons for that are detailed in our [Rulebook](/advanced/rulebook)), but the gist is that it was the cause of many "project doesn't work on my computer" issues, both in Yarn and other package managers.

To quickly detect which places may rely on unsafe patterns run `yarn dlx @yarnpkg/doctor` in your project - it'll statically analyze your sources to try to locate the most common issues that could result in a subpar experience. For example here's what running it on the `webpack-dev-server` repository would reveal:

```
➤ YN0000: Found 1 package(s) to process
➤ YN0000: For a grand total of 236 file(s) to validate

➤ YN0000: ┌ /webpack-dev-server/package.json
➤ YN0000: │ /webpack-dev-server/test/testSequencer.js:5:19: Undeclared dependency on @jest/test-sequencer
➤ YN0000: │ /webpack-dev-server/client-src/default/webpack.config.js:12:14: Webpack configs from non-private packages should avoid referencing loaders without require.resolve
➤ YN0000: │ /webpack-dev-server/test/server/contentBase-option.test.js:68:8: Strings should avoid referencing the node_modules directory (prefer require.resolve)
➤ YN0000: └ Completed in 5.12s

➤ YN0000: Failed with errors in 5.12s
```

In this case, the doctor noticed that:

- `testSequencer.js` depends on a package without listing it as a proper dependency - which would be reported as an error at runtime under Plug'n'Play.

- `webpack.config.js` references a loader without passing its name to `require.resolve` - which is unsafe, as it means the loader won't be loaded from `webpack-dev-server`'s dependencies.

- `contentBase-option.test.js` checks the content of the `node_modules` folder - which wouldn't exist anymore under Plug'n'Play.

### Enabling it

1. Look into your `.yarnrc.yml` file for the [`nodeLinker`](/configuration/yarnrc#nodeLinker) setting
2. If you don't find it, or if it's set to `pnp`, then it's all good: you're already using Plug'n'Play!
3. Otherwise, remove it from your configuration file
4. Run `yarn install`
5. Commit the changes

### Editor support

We have a [dedicated documentation](/getting-started/editor-sdks), but if you're using VSCode (or some other IDE with Intellisense-like feature) the gist is:

1. Install the [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs) VSCode extension
2. Make sure that `typescript`, `eslint`, `prettier`, ... all dependencies typically used by your IDE extensions are listed at the *top level* of the project (rather than in a random workspace)
3. Run `yarn dlx @yarnpkg/sdks vscode`
4. Commit the changes - this way contributors won't have to follow the same procedure
5. For TypeScript, don't forget to select [Use Workspace Version](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript) in VSCode

### Final notes

Now you should have a working Yarn Plug'n'Play setup, but your repository might still need some extra care. Some things to keep in mind:

- There are no `node_modules` folders. Use `require.resolve` instead.
- There are no `.bin` folders. If you relied on them, use [`yarn run <binary name>`](#call-binaries-using-yarn-run-rather-than-node_modulesbin) instead.
- Replace any calls to `node` that are not inside the `scripts` field by `yarn node`.
- Custom pre-hooks (e.g. `prestart`) need to be called manually now (`yarn prestart`).

All of this and more is documented in the following sections. In general, we advise you at this point to try to run your application and see what breaks, then check here to find out tips on how to correct your install.

## General Advices

### Upgrade to Node.js 14.x or newer

Node.js 12.x reached its official End of Life in April 2022 and won't receive any further update. Yarn consequently doesn't support it anymore.

### Fix dependencies with `packageExtensions`

Packages sometimes forget to list their dependencies. In the past it used to cause many subtle issues, so Yarn now defaults to prevent such unsound accesses. Still, we don't want it to prevent you from doing your work as long as you can do it in a safe and predictable way, so we came up with the [`packageExtensions`](/configuration/yarnrc#packageExtensions) setting.

For example, if `react` was to forget to list a dependency on `prop-types`, you'd fix it like this:

```yaml
packageExtensions:
  "react@*":
    dependencies:
      prop-types: "*"
```

And if a Babel plugin was missing its peer dependency on `@babel/core`, you'd fix it with:

```yaml
packageExtensions:
  "@babel/plugin-something@*":
    peerDependencies:
      "@babel/core": "*"
```

Should you use dependencies or peer dependencies? It depends on the context; as a rule of thumb, if the package is a singleton (for example `react`, or `react-redux` which also relies on the React context), you'll want to make it a peer dependency. In other cases, where the package is just a collection of utilities, using a regular dependency should be fine (for example `tslib`, `lodash`, etc).

### Use `yarn dlx` instead of `yarn global`

Managing system-wide packages is outside of the scope of Yarn, so [`yarn global` has been removed](https://github.com/yarnpkg/berry/issues/821). We however still provide `yarn dlx` to run one off scripts. 

### Call binaries using `yarn run` rather than `node_modules/.bin`

The `node_modules/.bin` folder is an implementation detail, and the PnP installs don't generate it at all. Rather than relying on its existence, just use the `yarn run` command which can start both scripts and binaries:

```bash
yarn run jest
# or, using the shortcut:
yarn jest
```

### Call your scripts through `yarn node` rather than `node`

We now need to inject some variables into the environment for Node to be able to locate your dependencies. In order to make this possible, we ask you to use `yarn node` which transparently does the heavy lifting.

**Note:** this section only applies to the _shell CLI_. The commands defined in your `scripts` are unaffected, as we make sure that `node` always points to the right location, with the right variables already set.

### Explicitly call the `pre` and `post` scripts

Rewrite:

```json
{
  "scripts": {
    "prestart": "do-something",
    "start": "http-server"
  }
}
```

Into:

```json
{
  "scripts": {
    "prestart": "do-something",
    "start": "yarn prestart && http-server"
  }
}
```

**Note:** This only applies to user scripts, such as `start` & friends. It's still fine to use any of `preinstall`, `install`, and `postinstall`. Consult the [script documentation](/advanced/lifecycle-scripts) for more information.

### Setup your IDE for PnP support

Since Yarn Plug'n'Play doesn't generate `node_modules` folders, some IDE integrations may not work out of the box. Check our [guide](/getting-started/editor-sdks) to see how to fix them.

### Update your configuration to the new settings

Modern uses a different style of configuration files than Classic. While mostly invisible for the lockfile (because we convert them on the fly), it might cause some issues for your rc files.

- Classic used `.yarnrc` files, but Modern now uses `.yarnrc.yml`.

- As evidenced by the new file extension, the Yarnrc files are now to be written in [YAML](https://en.wikipedia.org/wiki/YAML).

- The configuration keys have changed. The comprehensive settings list is available in our [documentation](/configuration/yarnrc), but here are some particular changes you need to be aware of:

  - We no longer read any settings from the `.npmrc` files.

  - Custom registries are now configured via [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

  - Registry authentication tokens are now configured via [`npmAuthToken`](/configuration/yarnrc#npmAuthToken).

### Take a look at our end-to-end tests

We now run daily [end-to-end tests](https://github.com/yarnpkg/berry#current-status) against various popular JavaScript tools in order to make sure that we never regress - or be notified when third-party project ship incompatible changes.

Consulting the sources for those tests is a great way to check whether some special configuration values have to be set when using a particular toolchain.

### Don't use `bundleDependencies`

The `bundleDependencies` (or `bundledDependencies`) is an artifact of the past that used to let you define a set of packages that would be stored as-is within the package archive, `node_modules` and all. This feature has many problems:

- It uses `node_modules`, which doesn't exist under Plug'n'Play installs.
- It encodes the hoisting inside the package, messing with the hoisting from other packages.

So how to replace them? There are different ways:

- If you need to patch a package, just fork it or reference it through `file:` (it's perfectly fine even for transitive dependencies to use this protocol). The `portal:` and `patch:` protocols are also options, although they'll only work for Yarn consumers.

- If you need to ship a package to your customers as a standalone (no dependencies), bundle it yourself using Esbuild, Webpack, Rollup, or similar tools.

### Replace `nohoist` by `nmHoistingLimits`

The `nohoist` setting from Yarn 1 was made specifically for React Native (in order to help it support workspaces), but the way it worked (through glob patterns) was causing a lot of bugs and confusion, noone being really sure which patterns needed to be set. As a result, we've simplified this feature in order to only support three identified patterns.

If you were using `nohoist`, we recommend you remove it from your manifest configuration and instead set [`nmHoistingLimits`](/configuration/yarnrc#nmHoistingLimits) in your yarnrc file:

```yaml
nmHoistingLimits: workspaces
```

## CLI Commands

### Renamed

| Yarn Classic (1.x) | Yarn Modern |
| ------------------ | -------------------------- |
| `yarn audit`    | `yarn npm audit`           |
| `yarn create`   | `yarn dlx create-<name>` <br/> (`yarn create` still works, but prefer using `yarn dlx`) |
| `yarn global`   | `yarn dlx` <br/> ([Dedicated section](#use-yarn-dlx-instead-of-yarn-global)) |
| `yarn info`     | `yarn npm info`            |
| `yarn login`    | `yarn npm login`           |
| `yarn logout`   | `yarn npm logout`          |
| `yarn outdated` | `yarn upgrade-interactive` <br/> ([Read more on GitHub](https://github.com/yarnpkg/berry/issues/749)) |
| `yarn publish`  | `yarn npm publish`         |
| `yarn tag`      | `yarn npm tag`             |
| `yarn upgrade`  | `yarn up` <br/> (Will now upgrade packages across all workspaces)                 |
| `yarn install --production` | `yarn workspaces focus --all --production` |
| `yarn install --verbose` | `YARN_ENABLE_INLINE_BUILDS=true yarn install` |

### Removed from core

| <div style={{width: 150}}>Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn check`    | Cache integrity is now checked on regular installs; [read more on GitHub](https://github.com/yarnpkg/rfcs/pull/106) |
| `yarn import`   | First import to Classic, then migrate to 2.x |
| `yarn licenses` | Perfect use case for plugins; [read more on GitHub](https://github.com/yarnpkg/berry/issues/1164) |
| `yarn versions` | Use `yarn --version` and `node -p process.versions` |

### Not implemented yet

Those features simply haven't been implemented yet. Help welcome!

| <div style={{width: 150}}>Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn list`     | `yarn why` may provide some information in the meantime |
| `yarn owner`    | Will eventually be available as `yarn npm owner` |
| `yarn team`     | Will eventually be available as `yarn npm team` |

## Troubleshooting

### `Cannot find module [...]`

This error **doesn't** come from Yarn: it's emitted by the Node.js resolution pipeline, telling you a package cannot be found on disk.

If you have enabled Plug'n'Play, then the Node.js resolution pipeline is supposed to forward resolution requests to Yarn - meaning that if you get this message, it's that this forwarding didn't occur, and your first action should be to figure out why.

Usually, it'll be because you called a Node.js script using `node ./my-script` instead of `yarn node ./my-script`.

### `A package is trying to access [...]`

Although rare, some packages don't list all their dependencies. Now that we enforce boundaries between the various branches of the dependency tree, this kind of issue is more apparent than it used to be (although it's always been problematic).

The long term fix is to submit a pull request upstream to add the missing dependency to the package listing. Given that it sometimes might take some time before they get merged, we also have a more short-term fix available: create `.yarnrc.yml` in your project, then use the [`packageExtensions` setting](#fix-dependencies-with-packageextensions) to add the missing dependency to the relevant packages. Run `yarn install` to apply your changes, and voilà!

Should you choose to open a PR on the upstream repository, you will also be able to contribute your package extension to our [compat plugin](https://github.com/yarnpkg/berry/blob/master/packages/plugin-compat/sources/extensions.ts), helping the whole ecosystem move forward.
