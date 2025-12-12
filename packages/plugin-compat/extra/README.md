# Compat patches generator

## Overview

This directory contains scripts and files to generate the builtin patches. Each patched package has its own sub-directory.

For each package, the `patches` sub-directory contains the set of builtin patches that are applied to it. Each of those patch files is also known as a patch *slice*, and is marked with a semver range of package versions that the patch applies to.

The `gen-<package>-patch.ts` script is used to (re-)generate those patches and update the files in `../source/patches`, which are then bundled with Yarn.

## Running

The generator scripts can be run via the package script `build:patch:<package>`.

As a high-level overview, the script generates each patch slice by:
1. Running a package-specific build process to create the "before" and "after" states of the package
2. Running `git diff` to calculate the diff between the two
3. Validating the diff by trying to apply it as a patch to some versions of the package
4. Saving it to `patches`

After all slices are generated, they are aggregated, compressed, and encoded into the `../source/patches` bundles.

## Caching

There are two layers of caching applied. First, if a patch already exists in the `patches` directory, then the diff is used instead of building and calculating a fresh diff. Second, the "before" and "after" states created during builds are saved and reused to skip future builds.

The cache and other temporary files used by the generator are stored in `<tmp>/yarn-compat-gen-patches/`, where `<tmp>` is the system temporary directory. This directory can be changed by setting the `GEN_PATCHES_BASE_DIR` environment variable to an absolute path. The caches for each package are isolated under sub-directories.

When running the generator scripts, one or more semver ranges can be given as additional arguments. In that case, when generating any slice whose range overlaps with the given ranges, the cached patches and builds are not reused and a fresh patch is generated.

On Windows, it is recommended to exclude the cache from Windows Defender as its real-time protection has a huge negative impact to performance during I/O intensive builds.

## Package-specific notes

### `fsevents`

The build process for `fsevents` is simply downloading and extracting the package from npm and copying patched and/or new files into the package.

### `resolve`

The build process for `resolve` is similar to that for `fsevents` -- downloading the package from npm and copying patched and/or new files into the package.

### `typescript`

For `typescript`, the build process is much heavier. We clone `yarnpkg/TypeScript` (our own fork of the TypeScript repo) from GitHub, cherry-pick commits that implement PnP, and build the TypeScript distributables.

As the TypeScript repo uses Volta to pin the node and npm versions used to build it, installing Volta is recommended to ensure consistent builds. If Volta is not installed, the generator script only switches the npm version by running npm via Corepack. A warning is printed in this case.

If you already have a local clone of `yarnpkg/TypeScript`, you can use git's alternates mechanism to allow git to find objects in the local clone, via the `GIT_ALTERNATE_OBJECT_DIRECTORIES` environment variable. This way, you can generate patches using commits in the local clone. The local clone is also used to speed up the script's cloning and fetching operations. However, do note that PRs that update the patches should only reference public commits in `yarnpkg/Typescript` or our CI checks will fail on the PR.
