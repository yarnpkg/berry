---
category: getting-started
slug: /migration/guide
title: "Step-by-step"
description: A step-by-step and in-depth migration guide from Yarn 1 (Classic) to Yarn 2 (Berry).
sidebar_position: 2
---

:::tip
You may have heard about [Yarn Plug'n'Play](/features/pnp) and be worried that your project isn't compatible yet. **Don't worry!**

**This migration will let you keep your `node_modules` folder**. It's only once we're done that you'll have to decide whether you want to spend time migrating to Yarn PnP. Whether you do it or stay on `node_modules`, migrating to Yarn Modern will have [many benefits](/migration/overview).
:::

:::info
Note that those commands only need to be run once for the whole project and will automatically take effect for all your contributors as soon as they pull the branch, as long as they have [Corepack](https://nodejs.org/api/corepack.html) enabled.
:::

## Migration steps

1. Make sure you're using Node 18+
2. Run <CommandLineHighlight type={`inlineCode`} lines={[{type: `command`, command: {name: `corepack`, path: [`enable`], argv: [`enable`]}, split: false, tooltip: null, tokens: [{type: `path`, segmentIndex: 0, text: `enable`}]}]}/> to activate [Corepack](https://nodejs.org/api/corepack.html)
2. Go into your project directory
3. Run `yarn set version berry`
4. Convert your `.npmrc` and `.yarnrc` files into [`.yarnrc.yml`](/configuration/yarnrc) (details [here](/migration/guide#update-your-configuration-to-the-new-settings))
5. Run `yarn install` to migrate the lockfile
6. Commit all changes

Good, you should now have a working Yarn install! Some things might still require some adjustments in your CI scripts (for example the deprecation of [arbitrary `pre/post`-scripts](/advanced/lifecycle-scripts), or the renaming of `--frozen-lockfile` into `yarn install ! --immutable`), but at least we have a working project.

## Breaking changes

### Update your configuration to the new settings

Modern uses a different style of configuration files than Classic. While mostly invisible for the lockfile (because we convert them on the fly), it might cause issues if you rely on `.npmrc` or `.yarnrc` files.

- Yarn Modern now uses `.yarnrc.yml`. Any other file is now ignored - this includes `.npmrc`.
- As evidenced by the new file extension, the Yarnrc files are now to be written in [YAML](https://en.wikipedia.org/wiki/YAML).

Most configuration keys have also been renamed to be more consistent. The comprehensive list of available settings can be found on the [`.yarnrc.yml` dedicated documentation](/configuration/yarnrc), but here are some important ones:

- Custom registries are now configured via [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).
- Registry authentication tokens are now configured via [`npmAuthToken`](/configuration/yarnrc#npmAuthToken).

### Explicitly call the `pre` and `post` scripts

Some changes were made to how [lifecycle scripts](/advanced/lifecycle-scripts) work in order to clarify their purpose and remove confusing behaviors. One such change is that custom `pre` and `post` scripts are no longer supported. As a result, rewrite:

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

:::note
This only applies to user scripts, such as `start` & friends. It's still fine to use any of `preinstall`, `install`, and `postinstall`. Consult the [script documentation](/advanced/lifecycle-scripts) for more information.
:::

### Use `yarn dlx` instead of `yarn global`

Yarn focuses on *project management*, and managing system-wide packages was deemed to be outside of our scope. As a result, [`yarn global` got removed](https://github.com/yarnpkg/berry/issues/821) and needs to be replaced by `yarn dlx` to run one off scripts.

### Don't use `bundleDependencies`

The `bundleDependencies` field (or `bundledDependencies`) is an artifact of the past that used to let you define a set of packages that would be stored as-is within the package archive, `node_modules` and all. This feature has many problems:

- It uses `node_modules`, which doesn't exist under Plug'n'Play installs.
- It encodes the hoisting inside the package, messing with the hoisting from other packages.

So how to replace them? There are different ways:

- If you need to patch a package, just fork it or reference it through the [`file:` protocol](/protocol/file) (it's perfectly fine even for transitive dependencies to use this protocol). The [`portal:`](/protocol/portal) and [`patch:`](/protocol/patch) protocols are also options, although they'll only work for Yarn consumers.

- If you need to ship a package to your customers as a standalone (no dependencies), bundle it yourself using Esbuild, Webpack, Rollup, or similar tools.

### Replace `nohoist` by `nmHoistingLimits`

The `nohoist` setting from Yarn Classic was built for React Native in order to support workspaces, but the way it worked (through glob patterns) was causing a lot of bugs and confusion, no one being really sure which patterns needed to be set. As a result, we've simplified this feature in order to only support three identified patterns.

If you were using `nohoist`, we recommend you remove it from your manifest configuration and instead set [`nmHoistingLimits`](/configuration/yarnrc#nmHoistingLimits) in your `.yarnrc.yml` file:

```yaml
nmHoistingLimits: workspaces
```

## CLI changes

### Renamed commands

| Yarn Classic (1.x) | Yarn Modern |
| --- | --- |
| `yarn audit` | `yarn npm audit` |
| `yarn create` | `yarn dlx create-NAME` |
| `yarn global` | `yarn dlx` ([Read more](#use-yarn-dlx-instead-of-yarn-global)) |
| `yarn info` | `yarn npm info` |
| `yarn list` | `yarn info -AR` (`yarn info ! --json`?) |
| `yarn login` | `yarn npm login` |
| `yarn logout` | `yarn npm logout` |
| `yarn outdated` | `yarn upgrade-interactive` ([Read more](https://github.com/yarnpkg/berry/issues/749)) |
| `yarn publish` | `yarn npm publish` |
| `yarn upgrade` | `yarn up` (note: updates all workspaces) |
| `yarn install --production` | `yarn workspaces focus --all --production` |

### Removed commands

| <div style={{width: 150}}>Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn check`    | Cache integrity is now checked on regular installs - [Read more](https://github.com/yarnpkg/rfcs/pull/106) |
| `yarn import`   | First import to Classic, then migrate to Yarn Modern |
| `yarn licenses` | Perfect use case for plugins - [Read more](https://github.com/yarnpkg/berry/issues/1164) |
| `yarn versions` | Use `yarn --version` and `node -p process.versions` |

### Not implemented yet

Those features simply haven't been implemented yet. Help welcome!

| <div style={{width: 150}}>Yarn Classic (1.x)</div> | Notes |
| ------------------ | ----------------------------- |
| `yarn owner`    | Will eventually be available as `yarn npm owner` |
| `yarn team`     | Will eventually be available as `yarn npm team` |
