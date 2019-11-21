---
category: advanced
path: /advanced/pnpapi
title: "PnP API"
---

## Overview

On top of being a simple install strategy, Plug'n'Play also provides a API that allows you to introspect the dependency tree at runtime.

## Data Structures

### `PackageLocator`

```ts
export type PackageLocator = {
  name: string,
  reference: string,
};
```

A package locator is an object describing one unique instance of a package in the dependency tree. The `name` field is guaranteed to be the name of the package itself, but the `reference` field should be considered an opaque string whose value may be whatever the PnP implementation decides to put there.

Note that one package locator is different from the others: the top-level locator (available through `pnp.topLevel`, cf below) sets *both* `name` and `reference` to `null`. This special locator will always point to the project folder (which is generally the root of the repository, even when working with workspaces).

### `PackageInformation`

```ts
export type PackageInformation = {
  packageLocation: string,
  packageDependencies: Map<string, null | string | [string, string]>,
  packagePeers: Set<string>,
  linkType: 'HARD' | 'SOFT',
};
```

The package information set describes the location where the package can be found on the disk, and the exact set of dependencies it is allowed to require. The `packageDependencies` values are meant to be interpreted as such:

- If a string, the value is meant to be used as a reference in a locator whose name is the dependency name.

- If a `[string, string]` tuple, the value is meant to be used as a locator whose name is the first element of the tuple and reference is the second one. This typically occurs with package aliases (such as `"foo": "npm:bar@1.2.3"`).

- If `null`, the specified dependency isn't available at all. This typically occurs when a package's peer dependency didn't get provided by its direct parent in the dependency tree.

The `packagePeers` field, if present, indicates which dependencies have an enforced contract on using the exact same instance as the package that depends on them. This field is rarely useful in pure PnP context (because our instantiation guarantees are stricter and more predictable than this), but is required to properly generate a `node_modules` directory from a PnP map.

The `linkType` field is only useful in specific cases - it describes whether the producer of the PnP API was asked to make the package available through an hard linkage (in which case all the `packageLocation` field is reputed being owned by the linker) or a soft linkage (in which case the `packageLocation` field represents a location outside of the sphere of influence of the linker).

## Runtime Constants

### `process.versions.pnp`

When operating under PnP environments, this value will be set to a number indicating the version of the PnP standard in use (which is strictly identical to `require('pnpapi').VERSIONS.std`).

This value is a convenient way to check whether you're operating under a Plug'n'Play environment (where you can `require('pnpapi')`) or not:

```js
if (process.versions.pnp) {
  // do something with the PnP API ...
} else {
  // fallback
}
```

### `require('pnpapi')`

When operating under a Plug'n'Play environment, a new builtin module will appear in your tree and will be made available to all your packages (regardless of whether they define it in their dependencies or not): `pnpapi`. It exposes the constants a function described in the rest of this document.

Note that we've reserved the `pnpapi` package name on the npm registry, so there's no risk that anyone will be able to snatch the name for nefarious purposes. We might use it later to provide a polyfill for non-PnP environments (so that you'd be able to use the PnP API regardless of whether the project got installed via PnP or not), but as of now it's still an empty package.

## API Interface

### `VERSIONS`

```ts
export const VERSIONS: {std: number, [key: string]: number};
```

The `VERSIONS` object contains a set of numbers that detail which version of the API is currently exposed. The only version that is guaranteed to be there is `std`, which will refer to the version of this document. Other keys are meant to be used to describe extensions provided by third-party implementors.

**Note:** The current version is 3. We bump it responsibly and strive to make each version backward-compatible with the previous ones, but as you can probably guess some features are only available with the latest versions.

### `topLevel`

```ts
export const topLevel: {name: null, reference: null};
```

The `topLevel` object is a simple package locator pointing to the top-level package of the dependency tree. Note that even when using workspaces you'll still only have one single top-level for the entire project.

This object is provided for convenience and doesn't necessarily needs to be used; you may create your own top-level locator by using your own locator literal with both fields set to `null`.

### `getLocator(...)`

```ts
export function getLocator(name: string, referencish: string | [string, string]): PackageLocator;
```

This function is a small helper that makes it easier to work with "referencish" ranges. As you may have seen in the `PackageInformation` interface, the `packageDependencies` map values may be either a string or a tuple - and the way to compute the resolved locator changes depending on that. To avoid having to manually make a `Array.isArray` check, we provide the `getLocator` function that does it for you.

Just like for `topLevel`, you're under no obligation to actually use it - you're free to roll your own version if for some reason our implementation wasn't what you're looking for.

### `getDependencyTreeRoots(...)`

```ts
export function getDependencyTreeRoots(): PackageLocator[];
```

The `getDependencyTreeRoots` function will return the set of locators that constitute the roots of individual dependency trees. In Yarn, there is exactly one such locator for each workspace in the project.

**Note:** The top-level locator (referenced by the `topLevel` field above) isn't required to be stored in this array as long as it is replaced by another locator that points to the exact same information.

### `getPackageInformation(...)`

```ts
export function getPackageInformation(locator: PackageLocator): PackageInformation;
```

The `getPackageInformation` function returns all the information stored inside the PnP API for a given package.

### `findPackageLocator(...)`

```ts
export function findPackageLocator(location: string): PackageLocator | null;
```

Given a location on the disk, the `findPackageLocator` function will return the package locator for the package that "owns" the path. For example, running this function on something conceptually similar to `/path/to/node_modules/foo/index.js` would return a package locator pointing to the `foo` package (and its exact version).

### `resolveToUnqualified(...)`

```ts
export function resolveToUnqualified(request: string, issuer: string | null, opts?: {considerBuiltins?: boolean}): string | null;
```

The `resolveToUnqualified` function is maybe the most important function exposed by the PnP API. Given a request (which may be a bare specifier like `lodash`, or an relative/absolute path like `./foo.js`) and the path of the file that issued the request, the PnP API will return an unqualified resolution.

For example, the following:

```
lodash/uniq
```

Might very well be resolved into:

```
/my/cache/lodash/1.0.0/node_modules/lodash/uniq
```

As you can see, the `.js` extension didn't get added. This is due to the difference between [qualified and unqualified resolutions](#qualified-vs-unqualified-resolutions). In case you must obtain a path ready to be used with the filesystem API, prefer using `resolveRequest` instead.

Note that in some cases you may just have a folder to work with as `issuer` parameter. When this happens, just suffix the issuer with an extra slash (`/`) to indicate to the PnP API that the issuer is a folder.

This function will return `null` if the request is a builtin module, unless `considerBuiltins` is set to `false`.

### `resolveUnqualified(...)`

```ts
export function resolveUnqualified(unqualified: string, opts?: {extensions?: string[]}): string;
```

The `resolveUnqualified` function is mostly provided as an helper; it reimplements the Node resolution for file extensions and folder indexes, but not the regular `node_modules` traversal. It makes it slightly easier to integrate PnP into some projects, although it isn't required in any way if you already have something that fits the bill.

To give you an example `resolveUnqualified` isn't needed with `enhanced-resolved`, used by Webpack, because it already implements its own way the logic contained in `resolveUnqualified` (and more). Instead, we only have to leverage the lower-level `resolveToUnqualified` function and feed it to the regular resolver.

For example, the following:

```
/my/cache/lodash/1.0.0/node_modules/lodash/uniq
```

Might very well be resolved into:

```
/my/cache/lodash/1.0.0/node_modules/lodash/uniq/index.js
```

### `resolveRequest(...)`

```ts
export function resolveRequest(request: string, issuer: string | null, opts?: {considerBuiltins?: boolean, extensions?: string[]]}): string | null;
```

The `resolveRequest` function is a wrapper around both `resolveToUnqualified` and `resolveUnqualified`. In essence, it's a bit like calling `resolveUnqualified(resolveToUnqualified(...))`, but shorter.

Just like `resolveUnqualified`, `resolveRequest` is entirely optional and you might want to skip it to directly use the lower-level `resolveToUnqualified` if you already have a resolution pipeline that just needs to add support for Plug'n'Play.

For example, the following:

```
lodash
```

Might very well be resolved into:

```
/my/cache/lodash/1.0.0/node_modules/lodash/uniq/index.js
```

This function will return `null` if the request is a builtin module, unless `considerBuiltins` is set to `false`.

### `resolveVirtual(...)`

```ts
export function resolveVirtual(path: string): string | null;
```

**Important:** This function is not part of the Plug'n'Play specification and only available as a Yarn extension. In order to use it, you first must check that the [`VERSIONS`](/advanced/pnp-api#versions) dictionary contains a valid `resolveVirtual` property.

The `resolveVirtual` function will accept any path as parameter and return the same path minus any [virtual component](/advanced/lexicon#virtual-package). This makes it easier to store the location to the files in a portable way as long as you don't care about losing the dependency tree information in the process (requiring files through those paths will prevent them from accessing their peer dependencies).

## Qualified vs Unqualified Resolutions

This document detailed two types of resolutions: qualified and unqualified. Although similar, they present different characteristics that make them suitable in different settings.

The difference between qualified and unqualified resolutions lies in the quirks of the Node resolution itself. Unqualified resolutions can be statically computed without ever accessing the filesystem, but only can only resolve relative paths and bare specifiers (like `lodash`); they won't ever resolve the file extensions or folder indexes. By contrast, qualified resolutions are ready to be used to access the filesystem.

Unqualified resolutions are the core of the Plug'n'Play API; they represent data that cannot be obtained any other way. If you're looking to integrate Plug'n'Play inside your resolver, they're likely what you're looking for. On the other hand, fully qualified resolutions are handy if you're working with the PnP API as a one-off and just want to obtain some information on a given file or package.

Two great options for two different use cases 🙂

## Accessing the files

The paths returned in the `PackageInformation` structures are in the native format (so Posix on Linux/OSX and Win32 on Windows), but they may reference files outside of the typical filesystem. This is particularly true for Yarn, which references packages directly from within their zip archives.

To access such files, you can use the `@yarnpkg/fslib` project which abstracts the filesystem under a multi-layer architecture. For example, the following code would make it possible to access any path, regardless of whether they're stored within a zip archive or not:

```ts
import {PosixFS, ZipOpenFS} from '@yarnpkg/fslib';

// This will transparently open zip archives
const zipOpenFs = new ZipOpenFS();

// This will convert all paths into a Posix variant, required for cross-platform compatibility
const crossFs = new PosixFS(zipOpenfs);

console.log(crossFs.readFileSync(`C:\\path\\to\\archive.zip\\package.json`));
```

## Traversing the dependency tree

Note that the following implementation iterates over all the nodes in the tree and doesn't try at all to skip previously seen nodes. It results in an execution time of a few seconds for each workspace, which can quickly add up. Optimize as needed 🙂

```ts
const pnp = require(`pnpapi`);
const seen = new Set();

const getKey = locator =>
  JSON.stringify(locator);

const isPeerDependency = (pkg, parentPkg, name) =>
  getKey(pkg.packageDependencies.get(name)) === getKey(parentPkg.packageDependencies.get(name));

const traverseDependencyTree = (locator, parentPkg = null) => {
  // Prevent infinite recursion when A depends on B which depends on A
  const key = getKey(locator);
  if (seen.has(key))
    return;

  const pkg = pnp.getPackageInformation(locator);
  console.assert(pkg, `The package information should be available`);

  seen.add(key);

  for (const [name, referencish] of pkg.packageDependencies) {
    // Unmet peer dependencies
    if (referencish === null)
      continue;

    // Avoid iterating on peer dependencies - very expensive
    if (parentPkg !== null && isPeerDependency(pkg, parentPkg, name))
      continue;

    const childLocator = pnp.getLocator(name, referencish);
    traverseDependencyTree(childLocator, pkg);
  }

  seen.delete(key);
};

// Iterate on each workspace
for (const locator of pnp.getDependencyTreeRoots()) {
  console.log(locator.name);
  traverseDependencyTree(locator);
}
```
