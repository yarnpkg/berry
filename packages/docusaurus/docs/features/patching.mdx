---
category: features
slug: /features/patching
title: "Package patching"
description: How to fix your dependencies without having to fork them entirely while waiting for an update.
---

## Overview

It sometimes happen that you need to make small changes to a dependency, just to workaround some small issue. The recommended action is to make a PR upstream, but it may take time until your changes get through review and end up in a release; what to do in the meantime? You have two options:

- You can use the `git:` protocol, which will let you install a project straight from its development repository, provided it was correctly setup.

- Or you can use the `patch:` protocol to make small changes to the dependencies straight from your project, while keeping them separated from the original code.

No more waiting around for pull requests to be merged and published, no more forking repos just to fix that one tiny thing preventing your app from working: the builtin patch mechanism will always let you unblock yourself.

## Making patches

To create a patch, run the `yarn patch` command and pass it a package name to make Yarn extract the requested package in a temporary folder. You're then free to edit the files within the patch at your convenience.

Once you're done with your changes, run `yarn patch-commit -s` with the temporary folder as parameter: the patch will be generated in `.yarn/patches`, and applied to your project. Add it to Git, and you're set to go.

## Maintaining patches

By default, `yarn patch` will always reset the patch. If you wish to add new changes, use the `yarn patch ! --update` flag and follow the same procedure as before - your patch will be regenerated.

## Limitations

- Because they're currently computed at fetch time rather than resolution time, the package dependencies have already been resolved and patches won't be able to alter them. Instead, use the `packageExtensions` mechanism which is specifically made to add new runtime dependencies to packages.

- Patches are ill-suited for modifying binary files. Minified files are problematic as well, although we could improve the feature to automatically process such files through a Prettier-like tool.
