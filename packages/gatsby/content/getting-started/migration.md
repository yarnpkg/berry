---
category: getting-started
path: /getting-started/migration
title: "Migration"
description: A step-by-step and in-depth migration guide from Yarn 1 (Classic) to Yarn 2 (Berry).
---

Yarn v2 is a very different software from the v1. While one of our goals is to make the transition as easy as possible, some behaviors needed to be tweaked. To make things easier we've documented the most common problems that may arise when porting from one project to the other, along with suggestions to keep moving forward.

```toc
# This code block gets replaced with the Table of Contents
```

## Why should you migrate?

We answer this question in details [here](https://yarnpkg.com/getting-started/qa#why-should-you-upgrade-to-yarn-modern).

Put simply, there are very few reasons not to upgrade. Even if you don't use Plug'n'Play nor plan to use it, your project will still benefit from more stable `node_modules` layouts, improved performances, improved user experience, active development, and many other boons.

## Step by step

The following guide assumes that your project **doesn't** use [Plug'n'Play](/features/pnp) yet. If you do it's mostly the same process, except that you don't need to configure the linker. Congrats!

1. Run `npm install -g yarn` to update the global yarn version to latest v1
2. Go into your project directory
3. Run `yarn set version berry` to enable v2 (cf [Install](/getting-started/install) for more details)
4. If you used `.npmrc` or `.yarnrc`, you'll need to turn them into the [new format](/configuration/yarnrc) (see also [1](/getting-started/migration#update-your-configuration-to-the-new-settings), [2](https://yarnpkg.com/getting-started/migration#dont-use-npmrc-files))
5. Add [`nodeLinker: node-modules`](/configuration/yarnrc#nodeLinker) in your `.yarnrc.yml` file
6. Commit the changes so far (`yarn-X.Y.Z.js`, `.yarnrc.yml`, ...)
7. Run `yarn install` to migrate the lockfile
8. Take a look at [this article](/getting-started/qa#which-files-should-be-gitignored) to see what should be gitignored
9. Commit everything remaining

Some optional features are available via external plugins (you can build your own too!):

11. Run [`yarn plugin import interactive-tools`](/cli/plugin/import) if you want [`upgrade-interactive`](/cli/upgrade-interactive)
12. Run [`yarn plugin list`](/cli/plugin/list) to see what other official plugins exist and might be useful
13. Commit the yarn plugins

Good, you should now have a working Yarn install! Some things might still require a bit of work (for instance we deprecated [arbitrary `pre/post`-scripts](/advanced/lifecycle-scripts)), but those special cases will be documented on a case-by-case basis in the rest of this document (for example [here](/getting-started/migration#explicitly-call-the-pre-and-post-scripts)).

## Switching to Plug'n'Play

This step is completely optional - while we recommend to use Plug'n'Play for most new projects, it may sometimes require an average time investment to enable it on existing projects. For this reason, we prefer to list it here as a separate step that you can look into if you're curious or simply want the absolute best of what Yarn has to offer.

### Before we start

Plug'n'Play enforces strict dependency rules. In particular, you'll hit problems if you (or your dependencies) rely on unlisted dependencies (the reasons for that are detailed in our [Rulebook](/advanced/rulebook)), but the gist is that it was the cause of many "project doesn't work on my computer" issues, both in Yarn and other package managers).

To quickly detect which places may rely on unsafe patterns run `yarn dlx @yarnpkg/doctor` in your project - it'll statically analyze your sources to try to locate the most common issues that could result in a subpar experience. For example here's what `webpack-dev-server` would reveal:

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
5. Various files may have appeared; check [this article](/getting-started/qa#which-files-should-be-gitignored) to see what to put in your gitignore
6. Commit the changes

### Editor support

We have a [dedicated documentation](/getting-started/editor-sdks), but if you're using VSCode (or some other IDE with Intellisense-like feature) the gist is:

1. Install the [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs) VSCode extension
2. Make sure that `typescript`, `eslint`, `prettier`, ... all dependencies typically used by your IDE extensions are listed at the *top level* of the project (rather than in a random workspace)
3. Run `yarn dlx @yarnpkg/pnpify --sdk vscode`
4. Commit the changes - this way contributors won't have to follow the same procedure
5. For TypeScript, don't forget to select [Use Workspace Version](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript) in VSCode

### Final notes

Now you should have a working Yarn Plug'n'Play setup, but your repository might still need some extra care. Some things to keep in mind:

- There is no `node_modules` folder and no `.bin` folder. If you relied on these, [call `yarn run` instead](##call-binaries-using-yarn-run-rather-than-node_modulesbin).
- Replace any calls to `node` that are not inside a Yarn script with `yarn node`
- Custom pre-hooks (e.g. prestart) need to be called manually now

All of this and more is documented in the following sections. In general, we advise you at this point to try to run your application and see what breaks, then check here to find out tips on how to correct your install.

## General Advices

### Upgrade to Node 10.19 or newer

Node 8 reached its official End of Life in December 2019 and won't receive any further update. Yarn consequently doesn't support it anymore.

Note that Node 10 itself will reach its own End of Life on May 2021, so support for it will likely be removed from Yarn 3. As a result we recommend upgrading to Node 12 or 14 whenever you can.

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

### Use `yarn dlx` instead of `yarn global`

`yarn dlx` is designed to execute one off scripts that may have been installed as global packages with `yarn 1.x`. Managing system-wide packages is outside of the scope of `yarn`. To reflect this, `yarn global` has been removed. [Read more on GitHub](https://github.com/yarnpkg/berry/issues/821).

### Enable the PnP plugin when using Webpack 4

Webpack 5 supports PnP natively, but if you use Webpack 4 you'll need to add the [`pnp-webpack-plugin`](https://github.com/arcanis/pnp-webpack-plugin) plugin yourself.

### Upgrade `resolve` to 1.9+

The `resolve` package is used by many tools in order to retrieve the dependencies for any given folder on the filesystem. It's compatible with Plug'n'Play, but only starting from 1.9+, so make sure you don't have an older release in your dependency tree (especially as transitive dependency).

**Fix:** Open your lockfile, look for all the `resolve` entries that could match 1.9+ (for example `^1.0.0`), and remove them. Then run `yarn install` again. If you run `yarn why resolve`, you'll also get a good idea of which package is depending on outdated version of `resolve` - maybe you can upgrade them too?

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

We've written a [guide](/getting-started/editor-sdks) entirely designed to explain you how to use Yarn with your IDE. Make sure to take a look at it, and maybe contribute to it if some instructions are unclear or missing!

### Update your configuration to the new settings

Yarn 2 uses a different style of configuration files than Yarn 1. While mostly invisible for the lockfile (because we import them on the fly), it might cause some issues for your rc files.

- The main change is the name of the file. Yarn 1 used `.yarnrc`, but Yarn 2 is moving to a different name: `.yarnrc.yml`. This should make it easier for third-party tools to detect whether a project uses Yarn 1 or Yarn 2, and will allow you to easily set different settings in your home folders when working with a mix of Yarn 1 and Yarn 2 projects.

- As evidenced by the new file extension, the Yarnrc files are now to be written in [YAML](https://en.wikipedia.org/wiki/YAML). This has been requested for a long time, and we hope it'll allow easier integrations for the various third-party tools that need to interact with the Yarnrc files (think Dependabot, etc).

- The configuration keys have changed. The comprehensive settings list is available in our [documentation](/configuration/yarnrc), but here are some particular changes you need to be aware of:

  - Custom registries are now configured via [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

  - Registry authentication tokens are now configured via [`npmAuthToken`](/configuration/yarnrc#npmAuthToken).

  - The `yarn-offline-mirror` has been removed, since the offline mirror has been merged with the cache as part of the [Zero-Install effort](/features/zero-installs). Just commit the Yarn cache and you're ready to go.

### Don't use `.npmrc` files

On top of their naming, the way we load the Yarnrc files has also been changed and simplified. In particular:

- Yarn doesn't use the configuration from your `.npmrc` files anymore; we instead read all of our configuration from the `.yarnrc.yml` files whose available settings can be found in [our documentation](/configuration/yarnrc).

- As mentioned in the previous section, the yarnrc files are now called `.yarnrc.yml`, with an extension. We've completely stopped reading the values from the regular `.yarnrc` files.

- All environment variables prefixed with `YARN_` are automatically used to override the matching configuration settings. So for example, adding `YARN_NPM_REGISTRY_SERVER` into your environment will change the value of [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

### Take a look at our end-to-end tests

We now run daily [end-to-end tests](https://github.com/yarnpkg/berry#current-status) against various popular JavaScript tools in order to make sure that we never regress - or to be notified when those tools do.

Consulting the sources for those tests is a great way to check whether some special configuration values have to be set when using a particular toolchain.

### Don't use `bundleDependencies`

The `bundleDependencies` (or `bundledDependencies`) is an artifact of the past that used to let you define a set of packages that would be stored as-is within the package archive, `node_modules` and all. This feature has many problems:

- It uses `node_modules`, which doesn't easily allow different install strategies such as Plug'n'Play.
- It encodes the hoisting inside the package, which is the exact opposite of what we aim for
- It messes with the hoisting of other packages
- Etc, etc, etc

So how to replace them? There are different ways:

- If you need to patch a package, just fork it or reference it through `file:` (it's perfectly fine even for transitive dependencies to use this protocol). The `portal:` and `patch:` protocols are also options, although they'll only work for Yarn consumers.

- If you need to ship a package to your customers as a standalone (no dependencies), bundle it yourself using Webpack, Rollup, or similar tools.

### If required: enable the `node-modules` plugin

**[PnP Compatibility Table](/features/pnp#compatibility-table)**

Despite our best efforts some tools don't work at all under Plug'n'Play environments, and we don't have the resources to update them ourselves. There are only two notorious ones on our list: Flow, and React Native.

In such a radical case, you can enable the built-in [`node-modules` plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-node-modules) by adding the following into your local [`.yarnrc.yml`](/configuration/yarnrc) file before running a fresh `yarn install`:

```yaml
nodeLinker: node-modules
```

This will cause Yarn to install the project just like Yarn 1 used to, by copying the packages into various `node_modules` folders.

[More information about the `nodeLinker` option.](/configuration/yarnrc#nodeLinker)

### Replace `nohoist` by `nmHoistingLimits`

The `nohoist` setting from Yarn 1 was made specifically for React Native (in order to help it support workspaces), but the way it worked (through glob patterns) was causing a lot of bugs and confusion, noone being really sure which patterns needed to be set. As a result, we've simplified this feature in order to only support three identified patterns.

If you were using `nohoist`, we recommend you remove it from your manifest configuration and instead set [`nmHoistingLimits`](/configuration/yarnrc#nmHoistingLimits) in your yarnrc file:

```yaml
nmHoistingLimits: workspaces
```

## CLI Commands

### Renamed

| <div style="width:150px">Yarn Classic (1.x)</div> | <div style="width: 250px">Yarn (2.x)</div> | Notes |
| ------------------ | -------------------------- | ----------------------------- |
| `yarn create`   | `yarn dlx create-<name>`   | `yarn create` still works, but prefer using `yarn dlx` |
| `yarn global`   | `yarn dlx`                 | [Dedicated section](#use-yarn-dlx-instead-of-yarn-global) |
| `yarn info`     | `yarn npm info`            ||
| `yarn login`    | `yarn npm login`           ||
| `yarn logout`   | `yarn npm logout`          ||
| `yarn outdated` | `yarn upgrade-interactive` | [Read more on GitHub](https://github.com/yarnpkg/berry/issues/749) |
| `yarn publish`  | `yarn npm publish`         ||
| `yarn tag`      | `yarn npm tag`             ||
| `yarn upgrade`  | `yarn up`                  | Will now upgrade packages across all workspaces |
| `yarn install --production` | `yarn workspaces focus --all --production` | Requires the `workspace-tools` plugin

### Deprecated

| <div style="width:150px">Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn check`    | Cache integrity is now checked on regular installs; [read more on GitHub](https://github.com/yarnpkg/rfcs/pull/106) |

### Removed from core

| <div style="width:150px">Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn audit`    | Relied on an undocumented proprietary protocol; [read more on GitHub](https://github.com/yarnpkg/berry/issues/1187) |
| `yarn import`   | First import to Classic, then migrate to 2.x |
| `yarn licenses` | Perfect use case for plugins; [read more on GitHub](https://github.com/yarnpkg/berry/issues/1164) |

### Not implemented yet

Those features simply haven't been implemented yet. Help welcome!

| <div style="width:150px">Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn list`     | `yarn why` may provide some information in the meantime |
| `yarn owner`    | Will eventually be available as `yarn npm owner` |
| `yarn team`     | Will eventually be available as `yarn npm team` |
| `yarn unlink`   | Manually remove the `resolutions` entries from the `package.json` file for now |

## Troubleshooting

### `Cannot find module [...]`

Interestingly, this error often **doesn't** come from Yarn. In fact, seeing this message should be extremely rare when working with Yarn 2 projects and typically highlights that something is wrong in your setup.

This error appears when Node is executed without the proper environment variables. In such a case, the underlying application won't be able to access the dependencies and Node will throw this message. To fix that, make sure that the script is called through `yarn node [...]` (instead of `node [...]`) if you run it from the command line.

### `A package is trying to access another package [...]`

> **Full message:** A package is trying to access another package without the second one being listed as a dependency of the first one.

Some packages don't properly list their actual dependencies for a reason or another. Now that we've fully switched to Plug'n'Play and enforce boundaries between the various branches of the dependency tree, this kind of issue will start to become more apparent than it previously was.

The long term fix is to submit a pull request upstream to add the missing dependency to the package listing. Given that it sometimes might take sometime before they get merged, we also have a more short-term fix available: create `.yarnrc.yml` in your project, then use the [`packageExtensions` setting](/configuration/yarnrc#packageExtensions) to add the missing dependency to the relevant packages. Once you're done, run `yarn install` to apply your changes and voilà!

```yaml
packageExtensions:
  "debug@*":
    peerDependenciesMeta:
      "supports-color":
        optional: true
```

If you also open a PR on the upstream repository you will also be able to contribute your package extension to our [compat plugin](https://github.com/yarnpkg/berry/blob/master/packages/plugin-compat/sources/extensions.ts), helping the whole ecosystem move forward.
