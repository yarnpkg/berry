---
category: features
path: /features/zero-installs
title: 'Zero-Installs'
---

While not a feature in itself, the term "Zero Install" encompasses a lot of Yarn features tailored around one specific goal - to make your projects as stable and fast as possible by removing the main source of entropy from the equation: Yarn itself.

> **Important:** Zero-install is an *optional* philosophy. It has some drawbacks, and while we believe this workflow to be a defining feature for professional-grade projects we don't have any plans to ignore or deprecate the typical `yarn install` workflow in any way, now or in the future.

```toc
# This code block gets replaced with the Table of Contents
```

## How does Yarn impact a project's stability?

Yarn does its best to guarantee that running `yarn install` twice will give you the same result in both cases. The main way it does this is through a lockfile, which contains all the information needed for a project to be installed in a reproducible way across systems. But is it good enough?

While Yarn does its best to guarantee that what works now will keep working, there's always the off chance that a future Yarn release will introduce a bug that will prevent you from installing your project. Or maybe your production environments will change and `yarn install` won't be able to write in the temporary directories anymore. Or maybe the network will fail and your packages won't be available anymore. Or maybe your credentials will rotate and you will start getting authentication issues. Or ... so many things can go wrong, and not all of them are things we can control.

Note that these challenges are not unique to Yarn — you may remember a time when npm used to erase production servers due to a bug that reached one of their releases. This is exactly what we mean: any code that runs is code that can fail. And thanks to Murphy's law, we know that something that can fail *will* eventually fail. From there, it becomes clear that the only sure way to prevent such issues is to run as little code as possible.

## How do you reach this "zero-install" state you're advocating for?

In order to make a project zero-install, you must be able to use it as soon as you clone it. This is very easy starting from Yarn 2!

- The cache folder is by default stored within your project folder (in `.yarn/cache`). Just make sure you add it to your repository (see also, [Offline Cache](/features/offline-cache)).

  - Again, this whole workflow is optional. If at some point you decide that in the end you prefer to keep using a global cache, just toggle on `enableGlobalCache` in the [yarnrc settings](/configuration/yarnrc#enableGlobalCache) and it'll be back to normal.

- When running `yarn install`, Yarn will generate a `.pnp.js` file. Add it to your repository as well - it contains the dependency tree that Node will use to load your packages.

- Depending on whether your dependencies have install scripts or not (we advise you to avoid it if you can and prefer wasm-powered alternatives) you may also want to add the `.yarn/unplugged` and `.yarn/build-state.yml` entries.

And that's it! Push your changes to your repository, checkout a new one somewhere, and check whether running `yarn start` (or whatever other script you'd normally use) works.

## Concerns

### Is it different from just checking-in the `node_modules` folder?

Yes, very much. To give you an idea, a `node_modules` folder of 135k uncompressed files (for a total of 1.2GB) gives a Yarn cache of 2k binary archives (for a total of 139MB). Git simply cannot support the former, while the latter is perfectly fine.

Another huge difference is the number of changes. Back in Yarn 1, when updating a package, a huge amount of files had to be recreated, or even simply moved. When the same happens in a Yarn 2 install, you get a very predictable result: exactly one changed file for each added/removed package. This in turn has beneficial side effects in terms of performance and security, since you can easily spot the invalid checksums on a per-package basis.

### Does it have security implications?

Note that, by design, this setup requires that you trust people modifying your repository. In particular, projects accepting PRs from external users will have to be careful that the PRs affecting the package archives are legit (since it would otherwise be possible to a malicious user to send a PR for a new dependency after having altered its archive content). The best way to do this is to add a CI step (for untrusted PRs only) that uses the `--check-cache` flag:

```
$> yarn install --check-cache
```

This way Yarn will re-download the package files from whatever their remote location would be and will report any mismatching checksum.
