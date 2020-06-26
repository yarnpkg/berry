---
category: advanced
path: /advanced/error-codes
title: "Error Codes"
---

<!-- Never remove the entries in this file, as we want to support older releases -->

> *Are you a plugin author and want to declare your own error codes that don't match the semantic of the ones provided here? Please relinquish one character and use the `YNX` prefix (ex `YNX001`) instead of `YN0`!*
>
> *Keeping this convention will help our users to figure out which error codes can be found on this documentation and which ones should instead be checked against the individual documentation of the plugins they use.*

```toc
# This code block gets replaced with the Table of Contents
```

## YN0000 - `UNNAMED`

This code is used to log regular messages, mostly to align all the lines in the Yarn output. No worry!

## YN0001 - `EXCEPTION`

An exception had be thrown by the program.

This error typically should never happen (it should instead point to a different error message from this page so that it can be properly documented), so it should be considered a bug in Yarn. Feel free to open an issue or, even better, a pull request aiming to fix it.

## YN0002 - `MISSING_PEER_DEPENDENCY`

A package requests a peer dependency, but one or more of its parents in the dependency tree doesn't provide it.

Note that Yarn enforces peer dependencies at every level of the dependency tree. That is, if `─D>` is a dependency and `─P>` is a peer dependency,

```sh
# bad
project
├─D> packagePeer
└─D> packageA
     └─P> packageB
          └─P> packagePeer

# good
project
├─D> packagePeer
└─D> packageA
     ├─P> packagePeer
     └─D> packageB
          └─P> packagePeer
```

Depending on your situation, multiple options are possible:

* The author of `packageA` can fix this problem by adding a peer dependency on `packagePeer`. If relevant, they can use [optional peer dependencies](https://yarnpkg.com/configuration/manifest#peerDependenciesMeta.optional) to this effect.

* The author of `packageB` can fix this problem by marking the `packagePeer` peer dependency as optional - but only if the peer dependency is actually optional, of course!

* The author of `project` can fix this problem by manually overriding the `packageA` and/or `packageB` definitions via the [`packageExtensions` config option](/configuration/yarnrc#packageExtensions).

To understand more about this issue, check out [this blog post](https://dev.to/arcanis/implicit-transitive-peer-dependencies-ed0).

## YN0003 - `CYCLIC_DEPENDENCIES`

Two packages with build scripts have cyclic dependencies.

Cyclic dependencies are a can of worms. They happen when a package `A` depends on a package `B` and vice-versa Sometime can arise through a chain of multiple packages - for example when `A` depends on `B`, which depends on `C`, which depends on `A`.

While cyclic dependencies may work fine in the general Javascript case (and in fact Yarn won't warn you about it in most cases), they can cause issues as soon as build scripts are involved. Indeed, in order to build a package, we first must make sure that its own dependencies have been properly built. How can we do that when two packages reference each other? Since the first one to build cannot be deduced, such patterns will cause the build scripts of every affected package to simply be ignored (and a warning emitted).

There's already good documentation online explaining how to get rid of cyclic dependencies, the simplest one being to extract the shared part of your program into a third package without dependencies. So the first case we described would become `A` depends on `C`, `B` depends on `C`, `C` doesn't depend on anything.

## YN0004 - `DISABLED_BUILD_SCRIPTS`

A package has build scripts, but they've been disabled across the project.

Build scripts can be disabled on a global basis through the use of the `enable-scripts` settings. When it happens, a warning is still emitted to let you know that the installation might not be complete.

The safest way to downgrade the warning into a notification is to explicitly disable build scripts for the affected packages through the use of the `dependenciesMeta[].build` key.

## YN0005 - `BUILD_DISABLED`

A package has build scripts, but they've been disabled through its configuration.

Build scripts can be disabled on a per-project basis through the use of the `dependenciesMeta` settings from the `package.json` file. When it happens, a notification is still emitted to let you know that the installation might not be complete.

## YN0006 - `SOFT_LINK_BUILD`

A package has build scripts, but is linked through a soft link.

For Yarn, a hard link is when a package is owned by the package manager. In these instances Yarn will typically copy packages having build scripts into a project-local cache so that multiple projects with multiple dependency trees don't use the same build artifacts. So what's the problem with so-called "soft links"?

Soft links are when the package manager doesn't own the package source. An example is a workspace, or a dependency referenced through the `portal:` specifier. In these instances Yarn cannot safely assume that executing build scripts there is the intended behavior, because it would likely involve mutating your project or, even worse, an external location on your disk that might be shared by multiple projects. Since Yarn avoids doing anything unsafe, it cannot run build scripts on soft links.

There are a few workarounds:

  - Using `file:` instead of `portal:` will cause a hard link to be used instead of a soft link. The other side of the coin will be that the packages will be copied into the cache as well, meaning that changing the package source will require you to run `YARN_UPDATE_FILE_CACHE=1 yarn install` for your changes to be taken into account.

  - You can manually run `yarn run postinstall` (or whatever is named your build script) from the directory of the affected packages. This requires you to know in which order they'll have to be called, but is generally the safest option.

  - You can simply abstain from using build scripts with soft links. While this suggestion might seem like a bad case of "fix a problem by not encountering the problem", consider that build scripts in development might not be of the best effect from a developer experience perspective - they usually mean that you'll need to run a script before being able to see your changes, which is often not what you seek.

## YN0007 - `MUST_BUILD`

A package must be built.

This informational message occurs when Yarn wishes to let you know that a package will need to be built for the installation to complete. This usually occurs in only two cases: either the package never has been built before, or its previous build failed (returned a non-zero exit code).

## YN0008 - `MUST_REBUILD`

A package must be rebuilt.

This information message occurs when Yarn wishes to let you know that a package will need to be rebuilt in order for the installation to complete. This usually occurs in a single case: when the package's dependency tree has changed. Note that this also includes its transitive dependencies, which sometimes may cause surprising rebuilds (for example, if `A` depends on `B` that depends on `C@1`, and if Yarn decides for some reason that `C` should be bumped to `C@2`, then `A` will need to be rebuilt).

## YN0009 - `BUILD_FAILED`

A package build failed.

This problem typically doesn't come from Yarn itself, and simply means that a package described as having build directives couldn't get built successfully.

To see the actual error message, read the file linked in the report. It will contain the full output of the failing script.

## YN0010 - `RESOLVER_NOT_FOUND`

A resolver cannot be found for the given package.

Resolvers are the components tasked from converting ranges (`^1.0.0`) into references (`1.2.3`). They each contain their own logic to do so - the semver resolver is the most famous one but far from being the only one. The GitHub resolver transforms GitHub repositories into tarball urls, the Git resolver normalizes the paths sent to git, ... each resolver takes care of a different resolution strategy. A missing resolver means that one of those strategies is missing.

This error is usually caused by a Yarn plugin being missing.

## YN0011 - `FETCHER_NOT_FOUND`

A fetcher cannot be found for the given package.

Fetchers are the components that take references and fetch the source code from the remote location. A semver fetcher would likely fetch the packages from some registry, while a workspace fetcher would simply redirect to the location on the disk where the sources can be found.

This error is usually caused by a Yarn plugin being missing.

## YN0012 - `LINKER_NOT_FOUND`

A linker cannot be found for the given package.

Linkers are the components tasked from extracting the sources from the artifacts returned by the fetchers and putting them on the disk in a manner that can be understood by the target environment. The Node linker would use the Plug'n'Play strategy, while a PHP linker would use an autoload strategy instead.

This error is usually caused by a Yarn plugin being missing.

## YN0013 - `FETCH_NOT_CACHED`

A package cannot be found in the cache for the given package and will be fetched from its remote location.

When a package is downloaded from whatever its remote location is, Yarn stores it in a specific folder called then cache. Then, the next time this package was to be downloaded, Yarn simply check this directory and use the stored package if available. This message simply means that the package couldn't be found there. It's not a huge issue, but you probably should try to limit it as much as possible - for example by using [Zero-Installs](/features/zero-installs).

## YN0014 - `YARN_IMPORT_FAILED`

A lockfile couldn't be properly imported from a v1 lockfile.

The v2 release contains major changes in the way Yarn is designed, and the lockfile format is one of them. In some rare cases, the data contained in the v1 lockfile aren't compatible with the ones we stored within the v2 files. When it happens, Yarn will emit this warning and resolve the package descriptor again. Only this package will be affected; all others will continue to be imported as expected.

## YN0015 - `REMOTE_INVALID`

The remote source returned invalid data.

This error is thrown by the resolvers and fetchers when the remote sources they communicate with return values that aren't consistent with what we would expect (for example because they are missing fields).

## YN0016 - `REMOTE_NOT_FOUND`

The remote source returned valid data, but told us the package couldn't be found.

This error is thrown by the resolvers and fetchers when the remote sources they communicate with inform them that the package against which have been made the request doesn't exist. This might happen if the package has been unpublished, and there's usually nothing Yarn can do.

## YN0017 - `RESOLUTION_PACK`

This error code isn't used at the moment (it used to print the number of packages that took part in each pass of the resolution algorithm, but was deemed too verbose compared to its usefulness).

## YN0018 - `CACHE_CHECKSUM_MISMATCH`

The checksum of a package from the cache doesn't match what the lockfile expects.

This situation usually happens after you've modified the zip archives from your cache by editing the files it contains for debug purposes. Use one of the two following commands in order to bypass it:

  - `YARN_CHECKSUM_BEHAVIOR=reset` will remove the files from the cache and download them again
  - `YARN_CHECKSUM_BEHAVIOR=update` will update the lockfile to contain the new checksum
  - `YARN_CHECKSUM_BEHAVIOR=ignore` will use the existing files but won't update the lockfile

## YN0019 - `UNUSED_CACHE_ENTRY`

A file from the cache has been detected unused by `yarn cache clean`.

After removing or upgrading a dependency you'll find that Yarn won't automatically remove the now obsolete files from your cache (this is because your cache might be shared by multiple projects, and in order to keep the history less messy). Running `yarn cache clean` will cause Yarn to try to figure out which packages from the cache aren't referenced by the current lockfile.

## YN0020 - `MISSING_LOCKFILE_ENTRY`

A package descriptor cannot be found in the lockfile.

A lot of commands (for example `yarn run`) require the lockfile to be in a state consistent with the current project in order to behave properly. This error will be generated when Yarn detects that your project references a package that isn't listed within the lockfile (usually because you modified a `dependencies` field without running `yarn install`, or because you added a new workspace). Running `yarn install` will almost certainly fix this particular error.

## YN0021 - `WORKSPACE_NOT_FOUND`

A dependency uses a `workspace:` range that cannot be resolved to an existing workspace.

The `workspace:` protocol is a new feature that appeared in Yarn v2 that allows to target a specific workspace of the current project without risking to ever pull data from other sources in case the workspace doesn't exist. This error precisely means that the workspace doesn't exist for the reason described in the error message.

## YN0022 - `TOO_MANY_MATCHING_WORKSPACES`

This error should be considered obsolete and not exist; open an issue if you have it.

## YN0023 - `CONSTRAINTS_MISSING_DEPENDENCY`

One of your workspaces should depend on a dependency but doesn't.

A [constraint](/features/constraints) has been put into effect that declares that the specified workspace must depend on the specified range of the specified dependency. Since it currently doesn't, Yarn emits this error when running `yarn constraints check`. In order to fix it simply run `yarn constraints fix` which will autofix all such errors.

## YN0024 - `CONSTRAINTS_INCOMPATIBLE_DEPENDENCY`

One of your workspaces should depend on a specific version of a dependency but doesn't.

A [constraint](/features/constraints) has been put into effect that declares that the specified workspace must depend on the specified range of the specified dependency. Since it currently doesn't, Yarn emits this error when running `yarn constraints check`. In order to fix it simply run `yarn constraints fix` which will autofix all such errors.

## YN0025 - `CONSTRAINTS_EXTRANEOUS_DEPENDENCY`

One of your workspaces shouldn't depend on one of the dependencies it lists.

A [constraint](/features/constraints) has been put into effect that declares that the specified workspace must depend on the specified range of the specified dependency. Since it currently doesn't, Yarn emits this error when running `yarn constraints check`. In order to fix it simply run `yarn constraints fix` which will autofix all such errors.

## YN0026 - `CONSTRAINTS_INVALID_DEPENDENCY`

One of your workspaces lists an invalid dependency.

A [constraint](/features/constraints) has been put into effect that declares that the specified workspace probably shouldn't depend on the specified dependency in its current state. Since it currently does, Yarn emits this error when running `yarn constraints check`. Fixing this error require manual intervention as the fix is ambiguous from Yarn's point of view.

## YN0027 - `CANT_SUGGEST_RESOLUTIONS`

Yarn cannot figure out proper range suggestions for the packages you're adding to your project.

When running `yarn add` without adding explicit ranges to the packages to add, Yarn will try to find versions that match your intent. Generally it means that it will prefer project workspaces and, if it cannot find any, will instead try to query the npm registry for the list of published releases and use whatever is the highest one. This error means that this process failed and Yarn cannot successfully figure out which version of the package should be added to your project.

## YN0028 - `FROZEN_LOCKFILE_EXCEPTION`

Your lockfile would be modified if Yarn was to finish the install.

When passing the `--frozen-lockfile` option to `yarn install`, Yarn will ensure that the lockfile isn't modified in the process and will instead throw an exception if this situation was to happen (for example if a newly added package was missing from the lockfile, or if the current Yarn release required some kind of migration before being able to work with the lockfile).

This option is typically meant to be used on your CI and production servers, and fixing this error should simply be a matter of running `yarn install` on your local development environment and submitting a PR containing the updated lockfile.

## YN0029 - `CROSS_DRIVE_VIRTUAL_LOCAL`

This error code is deprecated.

## YN0030 - `FETCH_FAILED`

This error code isn't used at the moment; we ideally want to explain **why** did the fetch fail rather than .

## YN0031 - `DANGEROUS_NODE_MODULES`

Yarn is installing packages using [Plug'n'Play](/features/pnp), but a `node_modules` folder has been found.

This warning is emitted when your project is detected as containing `node_modules` folders that actually seem to contain packages. This is not advised as they're likely relicts of whatever package manager you used before, and might confuse your tools and lead you into "works on my machine" situations.

## YN0032 - `NODE_GYP_INJECTED`

In some situation Yarn might detect that `node-gyp` is required by a package without this package explicitly listing the dependency. This behavior is there for legacy reason and should not be relied upon for the following reasons:

- The main way to detect whether `node-gyp` is implicitly required is to check whether the package contains a `bindings.gyp` file. However, doing this check implies that the package listing is known at the time Yarn resolves the dependency tree. This would require to fetch all npm archives as part of the resolution step (rather than wait until the dedicated fetch step), and all that just for the sake of this problematic feature.

- Implicit dependencies on `node-gyp` don't provide any hint to the package manager as to which versions of `node-gyp` are compatible with the package being built. Yarn does its best by adding an implicit dependency on `npm:*`, but it might be wrong and we'll have no way to know it - your installs will just crash unexpectedly when compiled with incompatible versions.

Packages omitting `node-gyp` usually do so in order to decrease the amount of packages in the final dependency tree when building the package isn't required (prebuilt binaries). While a reasonable wish, doing this goes against the package manager rules and we would prefer to solve this through a dedicated feature rather than through such hacks. In the meantime we strongly recommend to consider prebuilding native dependencies via WebAssembly if possible - then the `node-gyp` problem completely disappears.

## YN0046 - `AUTOMERGE_FAILED_TO_PARSE`

This error is triggered when Git conflict tokens are found within the `yarn.lock` file and one or both of the individual candidate lockfiles cannot be parsed. This typically happens because of one of those two situations:

- If you're working on a branch with Yarn v2 and are trying to merge a branch using Yarn v1, this error will be triggered (the v1 lockfiles aren't Yaml, which prevents them from being parsed. Even if we could, they don't contain enough information compared to the v2 lockfiles).

  - The easiest way to fix it is to use `git checkout --theirs yarn.lock`, and follow up with `yarn install` again (which can be followup by `yarn cache clean` to remove any file that wouldn't be needed anymore). This will cause the v1 lockfile to be re-imported. The v2 resolutions will be lost, but Yarn will detect it and resolve them all over again.

- If you have multiple levels of conflicts. Yarn doesn't support such conflicts, and you'll have to figure out a way to only have two levels. This is typically done by first resolving the conflicts between two branches, and then resolving them again on the merge result of the previous step and the third branch.

## YN0047 - `AUTOMERGE_IMMUTABLE`

This error is triggered when Git conflict tokens are found within the `yarn.lock` file while Yarn is executing under the immutable mode  (`yarn install --immutable`).

When under this mode, Yarn isn't allowed to edit any file, not even for automatically resolving conflicts. This mode is typically used on CI to ensure that your projects are always in a correct state before being merged into the trunk.

In order to solve this problem, try running `yarn install` again on your computer without the `--immutable` flag, then commit the changes if the command succeeded.

## YN0048 - `AUTOMERGE_SUCCESS`

This informational message is emitted when Git conflict tokens were found within the `yarn.lock` file but were automatically fixed by Yarn. There's nothing else to do, everything should work out of the box!

## YN0049 - `AUTOMERGE_REQUIRED`

This informational message is emitted when Git conflict tokens are found within the `yarn.lock` file. Yarn will then try to automatically resolve the conflict by following its internal heuristic.

The automerge logic is pretty simple: it will take the lockfile from the pulled branch, modify it by adding the information from the local branch, and run `yarn install` again to fix anything that might have been lost in the process.

## YN0050 - `DEPRECATED_CLI_SETTINGS`

This error is triggered when passing options to a CLI command through its arguments (for example `--cache-folder`).

Starting from the v2, this isn't supported anymore. The reason for this is that we've consolidated all of our configuration inside a single store that can be defined from a yarnrc file. This guarantees that all your commands run inside the same environments (which previously wasn't the case depending on whether you were using `--cache-folder` on all your commands or just the install). CLI options will now only be used to control the *one-time-behaviors* of a particular command (like `--verbose`).

**Special note for Netlify users:** Netlify currently [automatically passes](https://github.com/netlify/build-image/blob/f9c7f9a87c10314e4d65b121d45d68dc976817a2/run-build-functions.sh#L109) the `--cache-folder` option to Yarn, and you cannot disable it. For this reason we decided to make it a warning rather than an error when we detect that Yarn is running on Netlify (we still ignore the flag). We suggest upvoting [the relevant issue](https://github.com/netlify/build-image/issues/319) on their repository, as we're likely to remove this special case in a future major release.

## YN0059 - `INVALID_RANGE_PEER_DEPENDENCY`

A package requests a peer dependency, but the range provided is not a valid semver range. It is not possible to ensure the provided package meets the peer dependency request. The range must be fixed in order for the warning to go away. This will not prevent resolution, but may leave the system in an incorrect state.

## YN0060 - `INCOMPATIBLE_PEER_DEPENDENCY`

A package requests a peer dependency, but its parent in the dependency tree provides a version that does not satisfy the peer dependency's range. The parent should be altered to provide a valid version or the peer dependency range updated. This will not prevent resolution, but may leave the system in an incorrect state.

## YN0061 - `DEPRECATED_PACKAGE`

A package is marked as deprecated by the publisher. Avoid using it, use the alternative provided in the deprecation message instead.

