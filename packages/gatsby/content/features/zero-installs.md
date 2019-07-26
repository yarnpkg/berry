---
category: features
path: /features/zero-installs
title: 'Zero-Installs'
---

While not a feature in itself, the term "Zero Install" encompasses a lot of Yarn features tailored around one specific goal - to make your projects as stable and fast as possible by removing the main source of entropy from the equation: Yarn itself.

## How does Yarn impact a project's stability?

Yarn does its best to guarantee that running `yarn install` twice gives the same result in both cases. The main way it does this is through a lockfile, which provides all the information needed to install a project in a reproducible way. But is that really enough?

While Yarn does its best to guarantee that what works now will always work, there's the off chance that a future release introduces a bug that'll prevent you from installing your project. Or maybe your production machine's environment changes and `yarn install` cannot write in the temporary directory anymore, or the network fails and your packages aren't available, or your credentials rotate and you get authentication issues, or ... so many things can go wrong.

Finally, note that these challenges are not unique to Yarn - you probably still remember some npm bugs where system files were being removed from production servers. That's what we mean: any code that runs is code that will eventually fail. The only sure way to prevent such issues, now and in the future, is to run the least amount of code possible.

## How to reach this "zero-install" state you're advocating for?

In order to make a project zero-install, you must be able to use it as soon as you clone it. This is very easy starting from Yarn 2!

- The cache folder is by default stored within your project folder (in `.yarn/cache`). Just make sure you add it to your repository (see also, [Offline Cache](/features/offline-cache)).

- When running `yarn install`, Yarn will generate a `.pnp.js`. Add it to your repository as well (it contains the dependency tree that Node will use to load your packages).

- Depending on whether you use install scripts or not (we advise you to disable them if you write Javascript, as most use cases for native packages are better solved by wasm-powered packages anyway) also add the `.yarn/unplugged` and `.yarn/build-state.yml` entries.

And that's it! Push your changes to your repository, checkout a new one somewhere, and check whether running `yarn start` (or whatever other script you'd normally use) works.

## Security concerns

Note that, by design, this setup requires that you trust people modifying your repository. In particular, projects accepting PRs from external users will have to be careful that the PRs affecting the package archives are legit (since it would otherwise be possible to a malicious user to send a PR for a new dependency after having altered its archive content). The best way to do this would be to add a CI step (for untrusted PRs only) that removes the cache before running an install:

```
$> rm -rf $(yarn cache dir)
$> yarn install
```

This way Yarn will re-download the package files from whatever their remote location would be, and would report any mismatching checksum.
