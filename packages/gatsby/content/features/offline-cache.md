---
category: features
path: /features/offline-cache
title: "Offline Cache"
---

The offline cache is a feature that allows Yarn to work just fine even if the network goes down for any reason - whether it's because your employer didn't pay the utility bill or because the place where are hosted your packages becomes unavailable. It also is entirely compatible with [Zero-Installs](/features/zero-installs) and doesn't store more than a single file for each package, making it suitable for being stored within a repository.

The way it works is simple: each time a package is downloaded from a "remote" location ("remote" has a generic meaning in this context: `file:` dependencies' remote will be the filesystem, for example) a copy will be stored within the cache. The next time this package needs to be installed, Yarn will leverage this cache instead of the original source.

## Disabling the cache

Because the offline cache is leveraged to power PnP (files are read directly from within the zip archives), the cache cannot be disabled. That being said, it's totally safe to remove it entirely if needed - it will simply be rebuilt the next time you run `yarn install`.

## Cache integrity

Because the archive checksums are stored within the lockfile, any cache corruption will be detected at install-time and you'll be asked to resolve the problem - either by removing the corrupted file, or updating the checksum. The later isn't meant to be done except for advanced users in extremely specific cases.
