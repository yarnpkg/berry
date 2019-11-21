---
category: advanced
path: /advanced/migration
title: "Migration"
---

Yarn v2 is a very different software from the v1. While one of our aim is to make the transition as easy as possible, some behaviors needed to be tweaked. To make things easier we've documented the most common problems that may arise when porting from one project to the other, along with suggestions to keep moving forward.

## `A package is trying to access another package [...]`

> A package is trying to access another package without the second one being listed as a dependency of the first one

Some packages don't properly list their actual dependencies for a reason or another. Now that we've fully switched to Plug'n'Play and enforce boundaries between the various branches of the dependency tree, this kind of issue will start to become more apparent than it previously was.

The long term fix is to submit a pull request upstream to add the missing dependency to the package listing. Given that it sometimes might take sometime before they get merged, we also have a more short-term fix available: open your `yarn.lock` file, locate the entry for the faulty package, manually add a new `dependencies` entry with the missing dependency, then run `yarn install` to apply your changes.

Note that the short-term fix isn't meant to be long-term: you'll need to reapply it each time the package version changes and its metadata are downloaded from the registry again. Making the fix upstream is the best way to ensure your workflow won't get disrupted in the future.

## Yarnrc files

Yarn 2 uses a different style of configuration files than Yarn 1. While mostly invisible for the lockfile (because we import them on the fly), it might cause some issues for your rc files.

- The main change is the name of the file. The v1 uses `.yarnrc`, but starting from the v2 we'll be moving to a different name: `.yarnrc.yml`. This is in part to make it easier to configure both tools at the same time, as they use different syntaxes and configuration keys.

- As evidenced by the new extension, the Yarnrc files now have to be written in [YAML](https://en.wikipedia.org/wiki/YAML). It's been requested for a long time, and we hope it'll allow easier integrations for the various third-party tools that interact with the Yarnrc files.

- The configuration keys themselves have changed. You can find the comprehensive list of the supported configuration settings on the [dedicated documentation page](/configuration/yarnrc), but some particular changes you might be interested in:

  - Custom registries are now configured via [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

  - Registry authentication tokens are now configuration via [`npmAuthToken`](/configuration/yarnrc#npmAuthToken).

  - The `yarn-offline-mirror` has been removed, since the offline mirror has been merged with the cache as part of the [Zero-Install effort](/features/zero-installs).


## Yarnrc resolution

On top of their naming, the way we load the Yarnrc files has also been changed and simplified. In particular:

- Yarn doesn't use the configuration from your `.npmrc` files anymore; we instead read all of our configuration from the `.yarnrc.yml` files whose available settings can be found in [our documentation](/configuration/yarnrc).

- As mentioned in the previous section, the yarnrc files are now called `.yarnrc.yml`, with an extension. We've completely stopped reading the values from the regular `.yarnrc` files.

- All environment variables prefixed with `YARN_` are automatically used to override the matching configuration settings. So for example, adding `YARN_NPM_REGISTRY_SERVER` into your environment will change the value of [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

## Plug'n'Play

Starting from the v2, Plug'n'Play is enabled by default. This might cause compatibility issues in a few corner cases for projects that kept relying on unsafe patterns. Keep an eye on the [dedicated page](/features/pnp), and try to avoid those projects until they correct the situation. Also feel free to open an issue on Yarn's repository as well so that we can keep track of them and offer our help.

## TypeScript

If you're using TypeScript - and particularly the `tsc` binary - read on the [PnPify](/advanced/pnpify) page to learn more about a way to transparently make `tsc` compatible with Plug'n'Play. We actually use it on the Yarn repository itself!
