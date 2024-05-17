---
category: features
slug: /features/caching
title: "Cache strategies"
description: How to ensure your installs perform the absolute minimal amount of work.
---

## Overview

Yarn boasts a wide set of cache settings, letting you tweak depending on your preferred workflows or CI platforms. This documentation goes over some of the most interesting patterns to know.

:::tip
Yarn will by default cache everything you install and mutualize them for all other projects on your machine; this improves both installation speed and disk footprint, just like if you were using hardlinks.
:::

## Major patterns

### Offline mirror

When installed for the first time on a machine, packages are usually retrieved from the npm registry. While it usually works fine, it's not _always_ the case - the registry is known to experience issues from time to time that often result in failed installs. If you're not prepared, it may be a significant disruption for your developers, as switching branches and performing deploys can be much harder or unstable.

Some companies try to avoid this problem by configuring their registry to a mirror they control (for example by having a server run [Verdaccio](https://verdaccio.org/), an open-source implementation of the npm registry). It however requires a specific setup that isn't always easy to deploy to both developers and CI, and those systems sometimes come with [risks](https://medium.com/%2540alex.birsan/dependency-confusion-4a5d60fec610).

Yarn provides a very simple but effective alternative: by setting `enableGlobalCache` to false, it will save the package cache into a folder local to your project (by default `.yarn/cache`) that can then be added to Git. Every given commit is thus guaranteed to be installable, even should the npm registry go under.

### Zero-installs

Zero-installs are the combination of two Yarn features that allow you to skip having to think about running `yarn install` when switching branches - a requirement otherwise easy to forget until you see your tools crash.

As we saw, the offline mirror removes your project's dependency on the npm registry by keeping the Yarn cache within the repository. But can we go further, and directly make this cache the actual? The answer is yes!

As long as your project uses [Yarn PnP](/features/pnp) **and** the [offline mirror](#offline-mirror), all you have to do is add the loader files to Git, and you can forget `yarn install` most of the time. Since the PnP loaders have exactly the same content regardless of the machine that generated them, and since the offline cache will contain all the files that the loaders reference, the `git checkout` calls effectively double as `yarn install` of sort.

One caveat: adding or removing packages with native dependencies will still require `yarn install` to be run, as such packages depend on files that, unlike Node.js scripts, can't be evaluated directly from within their zip archives. Those packages are quite rare in practice, aren't frequently updated, and Yarn will display an helpful error message should you forget to do it, so this doesn't significantly impact the usefulness of the pattern.

:::info
Zero-installs are technically possible by adding your `node_modules` folders to Git. The difference however is that `node_modules` folders contain multiple thousands of files that Git each has to diff individually, that the hoisting causes them to frequently be moved around, and that people have a bad tendency to make manual changes to their `node_modules` folder that end up committed.

By contrast, adding your cache to Git and using Yarn PnP gives you a single folder with exactly one zip archive for each package, plus the PnP loader file. This is vastly easier for Git to track, as we saw earlier.
:::

## Specific environments

### GitHub Actions

:::info
We're still investigating the exact set of defaults that make GH Action caching more efficient. It's likely that we'll provide an official `yarn-cache` action mid-term for this purpose.
:::
