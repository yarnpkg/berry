---
category: advanced
path: /advanced/migration
title: "Migration"
---

Yarn v2 is a very different software from the v1. While one of our aim is to make the transition as easy as possible, some behaviors needed to be tweaked. To make things easier we've documented the most common problems that may arise when porting from one project to the other, along with suggestions to keep moving forward.

## General Advices

### Make sure you use `resolve@1.9+`

Older releases don't support Plug'n'Play at all. Since the `resolve` package is used by pretty much everything nowadays, making sure that you use a modern release can go a long way to solve the most obnoxious bugs you may have.

**How to do?** Open your lockfile, look for all the `resolve` entries that could match 1.9+ (for example `^1.0.0`), and remove them. Then run `yarn install` again. If you run `yarn why resolve`, you'll also get a good idea of which package is depending on outdated version of `resolve` - maybe you can upgrade them too?

### Call your scripts through `yarn node` rather than `node`

We now need to inject some variables into the environment for Node to be able to locate your dependencies. In order to make this possible, we ask you to use `yarn node` which transparently does the heavy lifting.

**Note:** this section only applies to the _shell CLI_. The commands defined in your `scripts` are unaffected, as we make sure that `node` always points to the right location.

### Updates your configuration to the new settings

Yarn 2 uses a different style of configuration files than Yarn 1. While mostly invisible for the lockfile (because we import them on the fly), it might cause some issues for your rc files.

- The main change is the name of the file. Yarn 1 used `.yarnrc`, but Yarn 2 is moving to a different name: `.yarnrc.yml`.

- As evidenced by the new file extension, the Yarnrc files are now to be written in [YAML](https://en.wikipedia.org/wiki/YAML). This has been requested for a long time, and we hope it'll allow easier integrations for the various third-party tools that need to interact with the Yarnrc files (think Dependabot, etc).

- The configuration keys themselves have changed. You can find the comprehensive list of the supported configuration settings on the [dedicated documentation page](/configuration/yarnrc), but some particular changes you might be interested in:

  - Custom registries are now configured via [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

  - Registry authentication tokens are now configuration via [`npmAuthToken`](/configuration/yarnrc#npmAuthToken).

  - The `yarn-offline-mirror` has been removed, since the offline mirror has been merged with the cache as part of the [Zero-Install effort](/features/zero-installs).

### Don't use the `.npmrc` files

On top of their naming, the way we load the Yarnrc files has also been changed and simplified. In particular:

- Yarn doesn't use the configuration from your `.npmrc` files anymore; we instead read all of our configuration from the `.yarnrc.yml` files whose available settings can be found in [our documentation](/configuration/yarnrc).

- As mentioned in the previous section, the yarnrc files are now called `.yarnrc.yml`, with an extension. We've completely stopped reading the values from the regular `.yarnrc` files.

- All environment variables prefixed with `YARN_` are automatically used to override the matching configuration settings. So for example, adding `YARN_NPM_REGISTRY_SERVER` into your environment will change the value of [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

### Take a look to the [integration tests](https://github.com/yarnpkg/berry#current-status)

We now run daily end-to-end tests against various popular JavaScript tools in order to make sure that we never regress - or to be notified when those tools do.

Consulting the sources for those tests is a great way to check whether some special configuration values have to be set when using a particular toolchain.

### If required: install the `node-modules` plugin

Despite our best efforts some tools don't work at all under Plug'n'Play environments, and we don't have the resources to update them ourselves. There are only two notorious ones on our list: Flow, and React Native.

In such a radical case, you can install the [`node-modules` plugin]() by running `yarn plugin import node-modules`. Once done, enable the linker in your local `.yarnrc.yml` file before running a fresh `yarn install`:

```yaml
nodeLinker: node-modules
```

This will cause Yarn to install the project just like Yarn 1 used to, by copying the packages into various `node_modules` folders. This install strategy is typically quite a bit slower and less stable than the modern one (read [Plug'n'Play](/features/pnp) for more details), but at the very least this will allow you to upgrade to our new CLI until you're ready to drop the `node_modules` linker.

## Troubleshooting

## `Cannot find module [...]`

Interestingly, this error **doesn't** come from Yarn. In fact, seeing this message shouldn't be possible when working with Yarn 2 projects and typically highlights that something is wrong in your setup.

This error appears when Node is executed without the proper environment variables. In such a case, the underlying application won't be able to access the dependencies and Node will throw this message. To fix that, make sure that the script is called through `yarn node [...]` (instead of `node [...]`) if you run it from the command line.

## `A package is trying to access another package [...]`

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
