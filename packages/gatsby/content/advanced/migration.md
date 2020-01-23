---
category: advanced
path: /advanced/migration
title: "Migration"
---

Yarn v2 is a very different software from the v1. While one of our aim is to make the transition as easy as possible, some behaviors needed to be tweaked. To make things easier we've documented the most common problems that may arise when porting from one project to the other, along with suggestions to keep moving forward.

## General Advices

### Upgrade to Node 10 or 12

Yarn doesn't support Node 8 anymore, as it's reached its end of life in December and won't receive any further update.

### Run the doctor

Run `npx @yarnpkg/check .` (or `yarn dlx @yarnpkg/check .`) in your project to quickly get an overview of potential issues found in your codebase. For example here's what `webpack-dev-server` would reveal:

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

Note that the doctor is intended to report any potential issue - it's then up to you to decide whether they are a false positive or not (for example it won't traverse Git repositories). For this reason we don't recommend using it as a CI tool.

### Make sure you use `resolve@1.9+`

Older releases don't support Plug'n'Play at all. Since the `resolve` package is used by pretty much everything nowadays, making sure that you use a modern release can go a long way to solve the most obnoxious bugs you may have.

**Fix:** Open your lockfile, look for all the `resolve` entries that could match 1.9+ (for example `^1.0.0`), and remove them. Then run `yarn install` again. If you run `yarn why resolve`, you'll also get a good idea of which package is depending on outdated version of `resolve` - maybe you can upgrade them too?

### Enable the PnP plugin when using Webpack 4

Webpack 5 will support PnP natively, but if you use Webpack 4 you'll need to add the [`pnp-webpack-plugin`](https://github.com/arcanis/pnp-webpack-plugin) plugin yourself.

### Don't use `resolve.alias|modules` (Webpack) or `moduleNameMapper` (Jest)

Those settings all try to override the regular resolution engine to provide custom rules. The downside is that they only apply to a single tool (so the configuration must be repeated again and again), and since the central Plug'n'Play resolver doesn't know about those aliases it'll think they are unlisted dependencies and refuse to let the resolution proceed.

Fortunately the fix is very simple: just use the `link:` protocol to list the aliases in your manifest file, as if they were regular dependencies! By doing this, you're also able to define your aliases a single time while ensuring that they will be picked up by your whole toolchain: Webpack, Jest, TypeScript, ...

So instead of:

```ts
module.exports = {
  resolve: {
    aliases: {
      assets: `./static/assets`
    },
  },
};
```

Prefer:

```json
{
  "dependencies": {
    "assets": "link:./static/assets"
  }
}
```

### Call your scripts through `yarn node` rather than `node`

We now need to inject some variables into the environment for Node to be able to locate your dependencies. In order to make this possible, we ask you to use `yarn node` which transparently does the heavy lifting.

**Note:** this section only applies to the _shell CLI_. The commands defined in your `scripts` are unaffected, as we make sure that `node` always points to the right location.

### Setup your IDE accordingly

We've written a [guide](https://next.yarnpkg.com/advanced/editor-sdks) entirely designed to explain you how to use Yarn with your IDE. Make sure to take a look at it, and maybe contribute to it if some instructions are unclear or missing!

### Update your configuration to the new settings

Yarn 2 uses a different style of configuration files than Yarn 1. While mostly invisible for the lockfile (because we import them on the fly), it might cause some issues for your rc files.

- The main change is the name of the file. Yarn 1 used `.yarnrc`, but Yarn 2 is moving to a different name: `.yarnrc.yml`. This should make it easier for third-party tools to detect whether a project uses Yarn 1 or Yarn 2, and will allow you to easily set different settings in your home folders when working with a mix of Yarn 1 and Yarn 2 projects.

- As evidenced by the new file extension, the Yarnrc files are now to be written in [YAML](https://en.wikipedia.org/wiki/YAML). This has been requested for a long time, and we hope it'll allow easier integrations for the various third-party tools that need to interact with the Yarnrc files (think Dependabot, etc).

- The configuration keys have changed. The comprehensive settings list is available in our [documentation](/configuration/yarnrc), but here are some particular changes you need to be aware of:

  - Custom registries are now configured via [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

  - Registry authentication tokens are now configuration via [`npmAuthToken`](/configuration/yarnrc#npmAuthToken).

  - The `yarn-offline-mirror` has been removed, since the offline mirror has been merged with the cache as part of the [Zero-Install effort](/features/zero-installs). Just commit the Yarn cache and you're ready to go.

### Don't use `.npmrc` files

On top of their naming, the way we load the Yarnrc files has also been changed and simplified. In particular:

- Yarn doesn't use the configuration from your `.npmrc` files anymore; we instead read all of our configuration from the `.yarnrc.yml` files whose available settings can be found in [our documentation](/configuration/yarnrc).

- As mentioned in the previous section, the yarnrc files are now called `.yarnrc.yml`, with an extension. We've completely stopped reading the values from the regular `.yarnrc` files.

- All environment variables prefixed with `YARN_` are automatically used to override the matching configuration settings. So for example, adding `YARN_NPM_REGISTRY_SERVER` into your environment will change the value of [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

### Take a look to our end-to-end tests

We now run daily [end-to-end tests](https://github.com/yarnpkg/berry#current-status) against various popular JavaScript tools in order to make sure that we never regress - or to be notified when those tools do.

Consulting the sources for those tests is a great way to check whether some special configuration values have to be set when using a particular toolchain.

### Don't use `bundleDependencies`

The `bundleDependencies` (or `bundledDependencies`) is an artifact of the past that used to let you define a set of packages that would be stored as-is within the package archive, `node_modules` and all. This feature has many problems:

- It uses `node_modules`, which doesn't easily allow different install strategies such as Plug'n'Play.
- It encodes the hoisting inside the package, which is the exact opposite of what we aim for
- It messes with the hoisting of other packages
- Etc, etc, etc

So how to replace them? There are different ways:

- If you need to patch a package, just fork it or reference it through `file:` or `portal:` (it's perfectly fine even for transitive dependencies to use those protocols).

- If you need to ship a package to your customers as a standalone package, bundle it yourself using Webpack, Rollup, or similar tools.

### If required: install the `node-modules` plugin

Despite our best efforts some tools don't work at all under Plug'n'Play environments, and we don't have the resources to update them ourselves. There are only two notorious ones on our list: Flow, and React Native.

In such a radical case, you can enable the [`node-modules` plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-node-modules) by adding the following into your local `.yarnrc.yml` file before running a fresh `yarn install`:

```yaml
nodeLinker: node-modules
```

This will cause Yarn to install the project just like Yarn 1 used to, by copying the packages into various `node_modules` folders. Remember that this plugin is currently very experimental and we expect it to improve over time.

## Troubleshooting

### `Cannot find module [...]`

Interestingly, this error **doesn't** come from Yarn. In fact, seeing this message should be extremely rare when working with Yarn 2 projects and typically highlights that something is wrong in your setup.

This error appears when Node is executed without the proper environment variables. In such a case, the underlying application won't be able to access the dependencies and Node will throw this message. To fix that, make sure that the script is called through `yarn node [...]` (instead of `node [...]`) if you run it from the command line.

### `A package is trying to access another package [...]`

> **Full message:** A package is trying to access another package without the second one being listed as a dependency of the first one.

Some packages don't properly list their actual dependencies for a reason or another. Now that we've fully switched to Plug'n'Play and enforce boundaries between the various branches of the dependency tree, this kind of issue will start to become more apparent than it previously was.

The long term fix is to submit a pull request upstream to add the missing dependency to the package listing. Given that it sometimes might take sometime before they get merged, we also have a more short-term fix available: create `.yarnrc.yml` in your project, then use the [`packageExtensions` setting]() to add the missing dependency to the relevant packages. Once you're done, run `yarn install` to apply your changes and voilà!

```yaml
packageExtensions:
  "debug@*":
    peerDependenciesMeta:
      "supports-color":
        optional: true
```
