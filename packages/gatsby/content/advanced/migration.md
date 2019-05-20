---
category: advanced
path: /advanced/migration
title: "Migration"
---

Yarn v2 is a very different software from the v1. While one of our aim is to make the transition as easy as possible, some behaviors needed to be tweaked. To make things easier we've documented the most common problems that may arise when porting from one project to the other, along with suggestions to keep moving forward.

## `A package is trying to access another package`

> A package is trying to access another package without the second one being listed as a dependency of the first one

Some packages don't properly list their actual dependencies for a reason or another. Now that we've fully switched to Plug'n'Play and actually enforce dependency visibility, this might become more apparent than it previously was, and this error might start to appear.

The long term fix is of course to submit a pull request upstream to add the missing dependency to the package listing. Given that it sometimes might take sometime before they get merged, we also have a more short-term fix available: open your `yarn.lock` file, locate the entry for the faulty package, manually add a new `dependencies` entry with the missing dependency, then run `yarn install` to apply your changes.

Note that the short-term fix isn't meant to be long-term: you'll need to reapply it each time the package version changes and its metadata are downloaded from the registry again.

## Yarn & lockfile format

> Parse error when loading {path}; please check it's proper Yaml (in particular, make sure you list the colons after each key name)

Starting from the v2 Yarn expects proper Yaml files by default. We still can read old-style files, but they must start with a particular comment:

```yaml
# yarn lockfile v1
```

Old-style files are very similar to Yaml, but with one major distinction: keys don't contain colons when their value is on the same line. The following old-style file:

```
hello-world:
  setting-a foo
  setting-b bar
```

Would look like the following once converted into Yaml:

```yaml
hello-world:
  settings-a: foo
  settings-b: foo
```

## Yarnrc file detection

The Yarnrc files mechanisms have been changed and simplified. In particular:

  - Yarn doesn't use the configuration from your `.npmrc` files anymore; we instead read all of our configuration from the `.yarnrc` files whose available settings can be found in [our documentation](/configuration/yarnrc).

  - All environment variables prefixed with `YARN_` are automatically used to override the matching configuration settings. So for example, adding `YARN_NPM_REGISTRY_SERVER` into your environment will change the value of [`npmRegistryServer`](/configuration/yarnrc#npmRegistryServer).

## Yarnrc settings

The settings available in the yarnrc file have changed. Using old, unsupported settings will cause Yarn to throw an exception at boot time unless properly guarded.

We recommend you to make sure you only use [modern settings](/configuration/yarnrc) if possible. In case a particular feature you relied on in the v1 is missing in the v2, feel free to open an issue on our repository to discuss whether we should add it back.

If you absolutely need to keep in your file hierarchy both v1 and v2 settings, you can use the special field named `berry`. Should Yarn v2+ find this field, it will use its content and ignore any other field. For example, the following file will work as expected on both the v1 and v2+ releases:

```yaml
# v1 settings
workspaces-experimental true

berry:
  # v2 settings
  enable-global-cache true
```

## Plug'n'Play

Starting from the v2, Plug'n'Play is enabled by default. This might cause compatibility issues in a few corner cases for projects that kept relying on unsafe patterns. Keep an eye on the [dedicated page](/features/pnp), and try to avoid those projects until they correct the situation. Also feel free to open an issue on Yarn's repository as well so that we can keep track of them and offer our help.

## TypeScript

If you're using TypeScript and particularly the `tsc` binary, read on the [/advanced/pnpify](PnPify) page to learn more about a way to transparently make `tsc` compatible with Plug'n'Play. We actually use it on the Yarn repository itself!
