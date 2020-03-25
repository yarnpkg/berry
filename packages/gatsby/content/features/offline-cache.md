---
category: features
path: /features/offline-cache
title: "Offline Cache"
---

The offline cache is a feature that allows Yarn to work just fine even should the network go down for any reason - whether it's because your employer didn't pay the utility bill or because the place where are hosted your packages becomes unavailable. It's also a critical part of [Zero-Installs](/features/zero-installs) and doesn't store more than a single file for each package - making it suitable for being stored within a repository, [as we actually do in the Yarn repository itself](https://github.com/yarnpkg/berry/tree/master/.yarn/cache).

The way it works is simple: each time a package is downloaded from a remote location ("remote" as a generic term in this context: dependencies listed through the `file:` protocol also have a remote, even if it will be the local filesystem in their case) a copy will be stored within the cache. The next time this same package will need to be installed, Yarn will leverage the version stored within cache instead of downloading its original source.

```toc
# This code block gets replaced with the Table of Contents
```

## Disabling the cache

Because the offline cache is leveraged to power PnP (files are read directly from within the zip archives), the cache cannot be disabled. That being said it's totally safe to remove the cache folder entirely if needed - it will simply be rebuilt the next time you run `yarn install`.

## Cleaning the cache

At the moment Yarn doesn't purge your cache from unneeded packages when you remove or upgrade them. To remove such unused files just periodically run [`yarn cache clean`](/cli/cache/clean). You can even make it [part of your CI](https://github.com/yarnpkg/berry/blob/master/azure-pipelines.yml#L28-L30)!

## Sharing the cache

Starting from Yarn v2, Yarn will by default configure the cache to be local to your project. This is done to make it easier for you to store it as part of your repository, which we believe is the best way to ensure that your projects can still be installed just fine regardless of the availability of your package registries.

Still, this might not make sense in every case. For example you might be working on a small library and not care enough to bother with checking-in your cache. If that's your case just add the following line into a `.yarnrc.yml` file local to your project. It will instruct Yarn to use a special path that will be shared by all projects that list the same configuration:

```yaml
enableGlobalCache: true
```

## Cache integrity

Because the archive checksums are stored within the lockfile, any cache corruption will be detected at install-time and you'll be asked to resolve the problem - either by removing the corrupted file, or updating the checksum. The later isn't meant to be done except for advanced users in extremely specific cases.
